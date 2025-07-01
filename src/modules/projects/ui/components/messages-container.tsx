'use client'

import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import MessageCard from "./message-card";
import MessageForm from "./message-form";
import { useEffect, useRef } from "react";
import { Fragment } from "@/generated/prisma";
import MessageLoading from "./message-loading";

/**
 * Displays and manages the message list for a given project, supporting fragment selection and automatic updates.
 *
 * Fetches messages for the specified project, highlights the active fragment, and allows users to select message fragments. Automatically scrolls to the latest message and periodically refreshes the message list. Renders a loading indicator if the last message is from the user and provides a form for submitting new messages.
 *
 * @param projectId - The identifier of the project whose messages are displayed.
 * @param activeFragment - The currently active message fragment, or null if none is selected.
 * @param setActiveFragment - Function to update the active fragment.
 */
export default function MessagesContainer({ 
    projectId, 
    activeFragment, 
    setActiveFragment
 }: { 
    projectId: string, 
    activeFragment: Fragment | null, 
    setActiveFragment: (fragment: Fragment | null) => void
 }) {
    const bottomRef = useRef<HTMLDivElement>(null);
    const trpc = useTRPC();
    const { data: messages } = useSuspenseQuery(trpc.messages.getMany.queryOptions({
        projectId: projectId
    }, {
        // TODO: THIS ACTUALLY REFETCHES EVERYTIME, FIX LATER
        refetchInterval: 5000,
    })); 

    useEffect(() => {
        const lastAssistantMessageWithFragment = messages.findLast(
            (message) => message.role === "ASSISTANT" && !!message.fragment
        );

        if (lastAssistantMessageWithFragment) {
            setActiveFragment(lastAssistantMessageWithFragment.fragment); 
        }
    }, [messages, setActiveFragment]);

    const lastMessage = messages[messages.length - 1 ]; 
    const isLastMessageUser = lastMessage?.role === "USER";

    useEffect(() => {
        bottomRef.current?.scrollIntoView();
    }, [messages])

    return (
        <div className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="pt-2 pr-1">
                    {messages.map((message) => (
                        <MessageCard
                            key={message.id}
                            content={message.content}
                            role={message.role}
                            fragment={message.fragment}
                            createdAt={message.createdAt}
                            isActiveFragment={activeFragment?.id === message.fragment?.id}
                            onFragmentClick={() => setActiveFragment(message.fragment)}
                            type={message.type}
                        />
                    ))}
                    { isLastMessageUser && <MessageLoading /> }
                    <div ref={bottomRef} />
                </div>
            </div>
            <div className="relative p-3 pt-1">
                <div className="absolute -top-6 left-0 right-0 h-6 bg-gradient-to-b from-transparent
                to-background pointer-events-none"/>
                <MessageForm projectId={projectId} />
            </div>
        </div>
    );
}