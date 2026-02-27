import type { SVGProps } from "react";

interface IconProps extends SVGProps<SVGSVGElement> {
    title?: string;
}

export default function VideoOnIcon({
    title = "Video on",
    ...props
}: IconProps) {
    return (
        <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden={title ? undefined : true}
            role={title ? "img" : undefined}
            {...props}
        >
            {title ? <title>{title}</title> : null}
            <path
                d="M15 10L21 6V18L15 14V10Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <rect
                x="3"
                y="6"
                width="12"
                height="12"
                rx="2"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}
