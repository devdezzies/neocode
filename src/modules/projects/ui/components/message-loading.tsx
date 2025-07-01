import Image from "next/image";
import { useEffect, useState } from "react";

const ShimmerMessages = () => {
    const messages = [
        "Thinking...", 
        "Loading...", 
        "Generating...", 
        "Analyzing your request...", 
        "Building your website", 
        "Crafting components...", 
        "Optimizing layout...",
        "Adding final touches...", 
        "Almost ready..."
    ]; 

    const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentMessageIndex((prev) => (prev + 1) % messages.length);
        }, 2000); 

        return () => clearInterval(interval);
    }, [messages.length]);

    return (
        <div className="flex items-center gap-2">
            <span className="text-base text-muted-foreground animate-pulse">
                {messages[currentMessageIndex]}
            </span>
        </div>
    );
}

/**
 * Displays a loading UI with a logo, label, and animated cycling status messages.
 *
 * Renders a vertically stacked container featuring a small logo and the label "Neo" at the top, followed by a dynamic message area that cycles through loading messages to indicate ongoing processing.
 */
export default function MessageLoading() {
    return (
        <div className="flex flex-col group px-2 pb-4">
            <div className="flex items-center gap-2 pl-2 mb-2">
                <Image 
                    src="/logo.svg"
                    alt="Neo logo"
                    width={15}
                    height={15}
                    className="shrink-0"
                />
                <span className="text-sm font-medium">
                    Neo
                </span>
            </div>
            <div className="pl-8.5 flex flex-col gap-y-4">
                <ShimmerMessages />
            </div>
        </div>
    );
}