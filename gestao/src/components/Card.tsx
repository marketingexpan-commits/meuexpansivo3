import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={twMerge(clsx("rounded-xl border border-gray-200 bg-white text-gray-950 shadow-sm", className))}
            {...props}
        >
            {children}
        </div>
    );
}

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={twMerge(clsx("flex flex-col space-y-1.5 p-6", className))} {...props}>{children}</div>;
}

export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
    return <h3 className={twMerge(clsx("font-semibold leading-none tracking-tight", className))} {...props}>{children}</h3>;
}

export function CardContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={twMerge(clsx("p-6 pt-0", className))} {...props}>{children}</div>;
}

export function CardFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={twMerge(clsx("flex items-center p-6 pt-0", className))} {...props}>{children}</div>;
}
