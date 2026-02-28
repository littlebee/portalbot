import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { PanTilt, mapPanTiltToXYSquare, mapXYToPanTilt } from "./PanTilt";
import st from "./PanTilt.module.css";

import type { IServoConfig } from "@/types/servo";

const panConfig: IServoConfig = {
    name: "pan",
    min_angle: -90,
    max_angle: 90,
};

const tiltConfig: IServoConfig = {
    name: "tilt",
    min_angle: -45,
    max_angle: 45,
};

describe("PanTilt", () => {
    it("renders pan/tilt labels and servo ranges", () => {
        render(
            <PanTilt
                panConfig={panConfig}
                tiltConfig={tiltConfig}
                panAngle={12.34}
                tiltAngle={-5.67}
            />,
        );

        expect(screen.getByText("Pan (12.3)")).toBeInTheDocument();
        expect(screen.getByText("Tilt (-5.7)")).toBeInTheDocument();
        expect(screen.getByText("90°")).toBeInTheDocument();
        expect(screen.getByText("-90°")).toBeInTheDocument();
        expect(screen.getByText("45°")).toBeInTheDocument();
        expect(screen.getByText("-45°")).toBeInTheDocument();
    });

    it("calls onAngleChange with mapped angles when the grid is clicked", () => {
        const onAngleChange = vi.fn();
        const { container } = render(
            <PanTilt
                panConfig={panConfig}
                tiltConfig={tiltConfig}
                panAngle={0}
                tiltAngle={0}
                onAngleChange={onAngleChange}
            />,
        );
        const grid = container.querySelector(`.${st.touchGrid}`);
        expect(grid).not.toBeNull();

        vi.spyOn(grid!, "getBoundingClientRect").mockReturnValue({
            left: 10,
            top: 20,
            right: 210,
            bottom: 220,
            width: 200,
            height: 200,
            x: 10,
            y: 20,
            toJSON: () => ({}),
        });

        fireEvent.click(grid!, { clientX: 60, clientY: 170 });

        expect(onAngleChange).toHaveBeenCalledTimes(1);
        expect(onAngleChange).toHaveBeenCalledWith(45, 22.5);
    });

    it("positions the angle indicator based on pan/tilt props", () => {
        const [x, y] = mapPanTiltToXYSquare(
            30,
            panConfig,
            -15,
            tiltConfig,
            200,
            10,
        );
        const { container } = render(
            <PanTilt
                panConfig={panConfig}
                tiltConfig={tiltConfig}
                panAngle={30}
                tiltAngle={-15}
            />,
        );

        const angleIndicator = container.querySelector<HTMLDivElement>(
            `.${st.angleXY}`,
        );
        expect(angleIndicator).not.toBeNull();
        expect(angleIndicator?.style.left).toBe(`${x}px`);
        expect(angleIndicator?.style.top).toBe(`${y}px`);
    });
});

describe("PanTilt mappers", () => {
    it("mapXYToPanTilt converts grid coordinates into expected angles", () => {
        expect(mapXYToPanTilt(0, 0, panConfig, tiltConfig, 200)).toEqual([
            90, -45,
        ]);
        expect(mapXYToPanTilt(100, 100, panConfig, tiltConfig, 200)).toEqual([
            0, 0,
        ]);
        expect(mapXYToPanTilt(200, 200, panConfig, tiltConfig, 200)).toEqual([
            -90, 45,
        ]);
    });

    it("mapPanTiltToXYSquare returns numeric XY coordinates", () => {
        const [x, y] = mapPanTiltToXYSquare(
            0,
            panConfig,
            0,
            tiltConfig,
            200,
            10,
        );
        expect(Number.isFinite(x)).toBe(true);
        expect(Number.isFinite(y)).toBe(true);
    });
});
