import ProjectView from "@/modules/projects/ui/views/project-view";
import { getQueryClient, trpc } from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import { Suspense } from "react";


export default async function Page({
    params,
}: {
    params: Promise<{ projectId: string }>
}) {
    const { projectId } = await params;
    // REMOTE FOR PREFETCHING
    const queryClient = getQueryClient();
    // PREFETCH
    void queryClient.prefetchQuery(trpc.messages.getMany.queryOptions({
        projectId: projectId
    }));
    void queryClient.prefetchQuery(trpc.projects.getOne.queryOptions({
        id: projectId
    }));

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <ErrorBoundary fallback={<p>Error</p>}>
                <Suspense fallback={<p>Loading...</p>}>
                    <ProjectView projectId={projectId} />
                </Suspense>
            </ErrorBoundary>
        </HydrationBoundary>
    );
}