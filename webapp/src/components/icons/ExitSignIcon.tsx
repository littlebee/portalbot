import type { SVGProps } from "react";

interface IconProps extends SVGProps<SVGSVGElement> {
    title?: string;
}

export default function ExitSignIcon({
    title = "Exit sign",
    style,
    ...props
}: IconProps) {
    return (
        <svg
            width="50"
            height="40"
            viewBox="10 8 30 60"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden={title ? undefined : true}
            role={title ? "img" : undefined}
            style={{ color: "#39FF14", ...style }}
            {...props}
        >
            {title ? <title>{title}</title> : null}
            <circle
                cx="25"
                cy="18"
                r="6"
                stroke="currentColor"
                strokeWidth="3"
            />
            <path
                d="M25 24V46"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
            />
            <path
                d="M25 30L16 38"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
            />
            <path
                d="M25 32L33 38"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
            />
            <path
                d="M25 46L14 62"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
            />
            <path
                d="M25 46L34 58"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
            />
            <path
                d="M15 27H8"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
            />
            <path
                d="M8 27L11 24M8 27L11 30"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}
