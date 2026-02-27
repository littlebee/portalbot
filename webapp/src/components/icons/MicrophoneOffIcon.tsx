import type { SVGProps } from "react";

interface IconProps extends SVGProps<SVGSVGElement> {
    title?: string;
}

export default function MicrophoneOffIcon({
    title = "Microphone off",
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
                d="M9 9.5V12C9 13.6569 10.3431 15 12 15C12.6029 15 13.1642 14.8222 13.6345 14.5164"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M15 12V6C15 4.34315 13.6569 3 12 3C10.7337 3 9.65016 3.78379 9.21003 4.89181"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M19 11C19 12.5825 18.4756 14.0426 17.5904 15.2165"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M5 11C5 14.866 8.13401 18 12 18C13.0197 18 13.9885 17.7821 14.8624 17.3904"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M12 18V22"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M8 22H16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M4 4L20 20"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}
