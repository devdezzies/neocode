import { useState, useMemo, useCallback, Fragment } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./ui/resizable";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, BreadcrumbEllipsis } from "./ui/breadcrumb";
import Hints from "./hint";
import { Button } from "./ui/button";
import { CheckIcon, CopyIcon } from "lucide-react";
import CodeView from "./code-view";
import { convertFilesToTreeItems } from "@/lib/utils";
import TreeView from "./tree-view";

type FileCollection = {
    [path: string]: string
}

interface FileBreadCrumpProps {
    filePath: string
}

interface FileExplorerProps {
    files: FileCollection,
}

function FileBreadCrumb({ filePath }: FileBreadCrumpProps) {
    const pathSegments = filePath.split("/");
    const maxSegments = 4;

    const renderBreadCrumbItems = () => {
        if (pathSegments.length <= maxSegments) {
            return pathSegments.map((segment, index) => {
                const isLast = index === pathSegments.length - 1;

                return (
                    <Fragment key={index}>
                        <BreadcrumbItem>
                            {isLast ? (
                                <BreadcrumbPage className="font-medium">
                                    {segment}
                                </BreadcrumbPage>
                            ) : (
                                <span className="text-muted-foreground">
                                    {segment}
                                </span>
                            )}
                        </BreadcrumbItem>
                        {!isLast && <BreadcrumbSeparator />}
                    </Fragment>
                )
            })
        } else {
            const firstSegment = pathSegments[0];
            const lastSegment = pathSegments[pathSegments.length - 1];

            return (
                <>
                    <BreadcrumbItem>
                        <span className="text-muted-foreground">
                            {firstSegment}
                        </span>
                    </BreadcrumbItem>

                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbEllipsis />
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />

                    <BreadcrumbItem>
                        <BreadcrumbPage className="font-medium">
                            {lastSegment}
                        </BreadcrumbPage>
                    </BreadcrumbItem>

                </>
            )
        }
    };

    return (
        <Breadcrumb>
            <BreadcrumbList>
                {renderBreadCrumbItems()}
            </BreadcrumbList>
        </Breadcrumb>
    )
}

// app.tsx => tsx
function getLanguageFromExtension(filename: string): string {
    const extension = filename.split(".").pop()?.toLowerCase();
    return extension || "text";
}

export default function FileExplorer({ files }: FileExplorerProps) {
    const [copied, setCopied] = useState(false);
    const [selectedFile, setSelectedFile] = useState<string | null>(() => {
        const fileKeys = Object.keys(files);
        return fileKeys.length > 0 ? fileKeys[0] : null;
    });

    const treeData = useMemo(() => {
        return convertFilesToTreeItems(files);
    }, [files]);

    const handleFileSelect = useCallback((filePath: string) => {
        if (files[filePath]) {
            setSelectedFile(filePath);
        }
    }, [files]);

    const handleCopy = useCallback(() => {
        if (selectedFile) {
            navigator.clipboard.writeText(files[selectedFile])
                .then(() => setCopied(true))
                .then(() => setTimeout(() => {
                    setCopied(false);
                }, 2000))
        }
    }, [selectedFile, files])

    return (
        <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={20} minSize={20} className="bg-sidebar">
                <TreeView
                    data={treeData}
                    value={selectedFile}
                    onSelect={handleFileSelect}
                />
            </ResizablePanel>
            <ResizableHandle className="hover:bg-primary transition-colors" />
            <ResizablePanel defaultSize={85} minSize={50}>
                {selectedFile && files[selectedFile] ? (
                    <div className="h-full w-full flex flex-col">
                        <div className="border-b bg-sidebar px-4 py-2 flex justify-between items-center gap-x-2">
                            <FileBreadCrumb filePath={selectedFile} />
                            <Hints text="Copy to clipboard" side="bottom">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="ml-auto"
                                    onClick={handleCopy}
                                    disabled={copied}
                                >
                                    {copied ? <CheckIcon /> : <CopyIcon />}
                                </Button>
                            </Hints>
                        </div>
                        <div className="flex-1 overflow-auto">
                            <CodeView
                                code={files[selectedFile]}
                                language={getLanguageFromExtension(selectedFile)}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                        Select a file to view its content
                    </div>
                )}
            </ResizablePanel>
        </ResizablePanelGroup>
    );
}