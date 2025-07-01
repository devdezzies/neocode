'use client'

import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import MessagesContainer from "../components/messages-container";
import { Suspense, useState } from "react";
import { Fragment } from "@/generated/prisma";
import ProjectHeader from "../components/project-header";

interface Props {
    projectId: string
}

/**
 * Displays a project workspace with a resizable two-panel layout, including project details, messages, and a placeholder for web preview.
 *
 * The left panel shows project information and messages, supporting fragment selection and asynchronous loading. The right panel is reserved for a future web preview feature.
 *
 * @param projectId - The unique identifier of the project to display
 */
export default function ProjectView({ projectId }: Props) {
    const [activeFragment, setActiveFragment] = useState<Fragment | null>(null);

    return (
        <div className="h-screen">
            <ResizablePanelGroup direction="horizontal">
                <ResizablePanel
                    defaultSize={35}
                    minSize={20}
                    className="flex flex-col min-h-0"    
                >
                    <Suspense fallback={<p>Loading project...</p>}>
                        <ProjectHeader projectId={projectId}/>
                    </Suspense>
                    <Suspense fallback={<p>Loading messages</p>}>
                        <MessagesContainer 
                            projectId={projectId} 
                            activeFragment={activeFragment}
                            setActiveFragment={setActiveFragment}
                        />
                    </Suspense>
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel
                    defaultSize={65}
                    minSize={50}
                >
                    <Suspense fallback={<p>Loading messages</p>}>
                        TODO: WEB PREVIEW HERE
                    </Suspense>
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
}