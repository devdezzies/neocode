import { inngest } from "./client";
import { openai, createAgent, createTool, createNetwork, Tool, Message, createState } from "@inngest/agent-kit";
import { Sandbox } from "@e2b/code-interpreter";
import { getSandbox, lastAssistantTextMessageContent } from "./utils";
import { z } from "zod";
import { FRAGMENT_TITLE_PROMPT, PROMPT, RESPONSE_PROMPT } from "@/prompt";
import { prisma } from "@/lib/db";
import { isArray } from "util";
import { SANDBOX_TIMEOUT } from "./types";

interface AgentState {
  summary: string,
  files: { [path: string]: string }
}

export const codeAgentFunction = inngest.createFunction(
  { id: "code-agent" },
  { event: "code-agent/run" },
  async ({ event, step }) => {
    const sandboxId = await step.run("get-sandbox-id", async () => {
      const sandbox = await Sandbox.create("neo-test-1");
      await sandbox.setTimeout(SANDBOX_TIMEOUT);
      return sandbox.sandboxId;
    }); 

    // add context for upcoming messages 
    const previousMessages = await step.run("get-previous-messages", async () => {
      const formattedMessages: Message[] = []; 

      const messages = await prisma.message.findMany({
        where: {
          projectId: event.data.projectId,
        }, 
        orderBy: {
          createdAt: "desc"
        }, 
        take: 5 // only take 5 messages max
      }); 

      for (const message of messages) {
        formattedMessages.push({
          type: "text", 
          role: message.role === "ASSISTANT" ? "assistant" : "user",
          content: message.content
        })
      }

      return formattedMessages.reverse();
    }); 

    // create a new state 
    const state = createState<AgentState>(
      {
        summary: "", 
        files: {}
      }, 
      {
        messages: previousMessages     
      }
    )

    const codeAgent = createAgent<AgentState>({
      name: "code-agent",
      description: "an expert AI coding agent",
      system: PROMPT,
      model: openai({
        model: "gemini-2.5-flash",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
        defaultParameters: {
          temperature: 0.1
        }
      }),
      tools: [
        // run terminal tool
        createTool({
          name: "terminal",
          description: "Use the terminal to run commands",
          parameters: z.object({
            command: z.string()
          }),
          handler: async ({ command }, { step }) => {
            return await step?.run("terminal", async () => {
              const buffers = { stdout: "", stderr: "" }

              try {
                const sandbox = await getSandbox(sandboxId);
                const result = await sandbox.commands.run(command, {
                  onStdout: (data: string) => {
                    buffers.stdout += data;
                  },
                  onStderr: (data: string) => {
                    buffers.stderr += data;
                  }
                });
                return result.stdout;
              } catch (e) {
                console.error(`Command failed ${e} \nstdout: ${buffers.stdout} \nstderr: ${buffers.stderr}`);
              }
            });
          }
        }),
        // tool for creates files
        createTool({
          name: "createOrUpdateFiles",
          description: "create of update files in the sandbox",
          parameters: z.object({
            files: z.array(
              z.object({
                path: z.string(),
                content: z.string()
              }),
            ),
          }),
          handler: async ({ files }, { step, network }: Tool.Options<AgentState>) => {
            const newFiles = await step?.run("createOrUpdateFiles", async () => {
              try {
                const updatedFiles = network.state.data.files || {};
                const sandbox = await getSandbox(sandboxId);
                for (const file of files) {
                  await sandbox.files.write(file.path, file.content);
                  updatedFiles[file.path] = file.content;
                }

                return updatedFiles;
              } catch (e) {
                return "Error: " + e;
              }
            });

            if (typeof newFiles === "object") {
              network.state.data.files = newFiles;
            }
          },
        }),
        // read files tool 
        createTool({
          name: "readFiles",
          description: "Read all files and store it in a json object",
          handler: async ({ files }, { step }) => {
            return await step?.run("readFiles", async () => {
              try {
                const sandbox = await getSandbox(sandboxId);
                const contents = [];
                for (const file of files) {
                  const content = await sandbox.files.read(file);
                  contents.push({ path: file, content });
                }

                return JSON.stringify(contents);
              } catch (e) {
                return "Error: " + e;
              }
            })
          }
        })
      ],
      lifecycle: {
        onResponse: async ({ result, network }) => {
          const lastAssistantMessageText = lastAssistantTextMessageContent(result);

          if (lastAssistantMessageText && network) {
            if (lastAssistantMessageText.includes("<task_summary>")) {
              network.state.data.summary = lastAssistantMessageText;
            }
          } else if (network) {
            network.state.data.summary = "The task was not generated successfully";
          }
          
          return result;
        }
      }
    });

    const network = createNetwork<AgentState>({
      name: "code-agent-network",
      agents: [codeAgent],
      defaultState: state,
      maxIter: 15,
      router: async ({ lastResult }) => {
        if (lastResult?.raw?.includes("<task_summary>")) {
          return;
        } // finish loop
        return codeAgent;
      }
    })

    const result = await network.run(event.data.value, { state: state });

    const fragmentTitleGenerator = createAgent({
      name: "fragment-title-generator", 
      description: "A fragment title generator", 
      system: FRAGMENT_TITLE_PROMPT, 
      model: openai({
        model: "gemini-2.0-flash",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
      }),
    });

    const responseGenerator = createAgent({
      name: "response-generator", 
      description: "A response generator", 
      system: RESPONSE_PROMPT, 
      model: openai({
        model: "gemini-2.0-flash",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
      }),
    });

    const { output: fragmentTitleOutput } = await fragmentTitleGenerator.run(result.state.data.summary); 
    const { output: responseOutput } = await responseGenerator.run(result.state.data.summary);

    function generateFragmentTitle(): string {
      if (fragmentTitleOutput[0].type !== "text") {
        return "Fragment";
      }

      if (Array.isArray(fragmentTitleOutput[0].content)) {
        return fragmentTitleOutput[0].content.map((txt) => txt).join("");
      } else {
        return fragmentTitleOutput[0].content;
      }
    }

    function generateResponse(): string {
      if (responseOutput[0].type !== "text") {
        return "Here you go";
      }

      if (Array.isArray(responseOutput[0].content)) {
        return responseOutput[0].content.map((txt) => txt).join("");
      } else {
        return responseOutput[0].content;
      }
    }

    const isError =
      !result.state.data.summary ||
      Object.keys(result.state.data.files || {}).length === 0;

    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      const sandbox = await getSandbox(sandboxId);
      const host = sandbox.getHost(3000);
      return `https://${host}`;
    })

    await step.run("save-result", async () => {
      if (isError) {
        return await prisma.message.create({
          data: {
            projectId: event.data.projectId,
            content: "Something went wrong. Please try again",
            role: "ASSISTANT",
            type: "ERROR"
          }
        })
      }

      return await prisma.message.create({
        data: {
          projectId: event.data.projectId,
          content: generateResponse(),
          role: "ASSISTANT",
          type: "RESULT",
          fragment: {
            create: {
              sandboxUrl: sandboxUrl,
              title: generateFragmentTitle(),
              files: result.state.data.files,
            }
          }
        }
      })
    })

    return {
      url: sandboxUrl,
      title: "Fragment",
      files: result.state.data.files,
      summary: result.state.data.summary
    }
  },
);
