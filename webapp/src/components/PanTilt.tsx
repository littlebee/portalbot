/*

This component was hoisted from basic_bot_react repository.  I decided not
to use any of the basic_bot_react components, because they rely on having
a direct connection to the basic_bot central hub.   Portalbot webapp does not
have a direct connection from the webapp to the central hub, because the
robot is possibly behind a firewall or NAT and unreachable.

All comm between the webapp and the robot goes through the public_server
herein.   Public server will validate, sanitize and relay messages to the
robot.

*/

import { useCallback, useMemo } from "react";

import st from "./PanTilt.module.css";

import type { IServoConfig } from "@/types/servo";

const TOUCH_GRID_SIZE = 200;
const ANGLE_INDICATOR_RADIUS = 10;

export interface PanTiltProps {
    /** Servo configuration defining pan and tilt servo parameters */
    panConfig: IServoConfig;
    tiltConfig: IServoConfig;
    /** Currently set servo servoAngles */
    panAngle: number;
    tiltAngle: number;
    /** Callback function called when servo servoAngles change */
    onAngleChange?: (panAngle: number, tiltAngle: number) => void;
}

/**
 * A touchscreen joystick for controlling pan and tilt servos.
 *
 * This component provides an interactive 2D control interface for adjusting
 * camera pan and tilt servos. Users can click or touch anywhere on the control
 * grid to set target servoAngles. Visual indicators show both target and actual
 * servo positions. Requires servo configuration with servos named "pan" and "tilt".
 *
 * Can be used with or without HubStateProvider:
 * - With props: Pass servoConfig, servoAngles, and servoActualAngles directly
 * - With provider: Wrap in HubStateProvider and props will be automatically populated
 */
export function PanTilt({
    panConfig,
    tiltConfig,
    panAngle,
    tiltAngle,
    onAngleChange,
}: PanTiltProps) {
    const [angleX, angleY]: [number, number] = useMemo(() => {
        return mapPanTiltToXYSquare(
            panAngle,
            panConfig,
            tiltAngle,
            tiltConfig,
            TOUCH_GRID_SIZE,
            ANGLE_INDICATOR_RADIUS,
        );
    }, [panAngle, tiltAngle, panConfig, tiltConfig]);

    const handleTouch = useCallback(
        (
            event:
                | React.MouseEvent<HTMLDivElement>
                | React.TouchEvent<HTMLDivElement>,
        ) => {
            const isTouch = isTouchEvent(event);
            const clientX = isTouch ? event.touches[0].clientX : event.clientX;
            const clientY = isTouch ? event.touches[0].clientY : event.clientY;

            const rect = event.currentTarget.getBoundingClientRect();
            const x = clientX - rect.left;
            const y = clientY - rect.top;
            const [newPanAngle, newTiltAngle] = mapXYToPanTilt(
                x,
                y,
                panConfig,
                tiltConfig,
                TOUCH_GRID_SIZE,
            );
            console.log({ x, y, newPanAngle, newTiltAngle });
            onAngleChange?.(newPanAngle, newTiltAngle);
        },
        [panConfig, tiltConfig],
    );

    return (
        <div className={st.bbrPanTilt} data-testid="pan-tilt">
            <h4>Pan ({panAngle.toFixed(1)})</h4>
            <div className={st.servoRange}>
                <div>{panConfig.max_angle}&deg;</div>
                <div className={st.spacer} />
                <div>{panConfig.min_angle}&deg;</div>
            </div>
            <div className={st.innerContainer}>
                <div className={st.tiltLabelsContainer}>
                    <h4>Tilt ({tiltAngle.toFixed(1)})</h4>
                    <div className={st.servoRange}>
                        <div>{tiltConfig.max_angle}&deg;</div>
                        <div className={st.spacer} />
                        <div>{tiltConfig.min_angle}&deg;</div>
                    </div>
                </div>
                <div
                    className={st.touchGrid}
                    onClick={handleTouch}
                    onTouchEnd={handleTouch}
                >
                    <div
                        className={st.angleXY}
                        style={{ top: `${angleY}px`, left: `${angleX}px` }}
                    />
                </div>
            </div>
        </div>
    );
}

/**
 * Converts pan/tilt servo servoAngles to XY coordinates in a square control grid.
 *
 * Maps servo servoAngles to pixel coordinates for displaying position indicators
 * in a pan/tilt control interface. Accounts for servo range constraints and
 * indicator size.
 *
 * @param panAngle - Current pan angle in degrees
 * @param panConfig - Pan servo configuration
 * @param tiltAngle - Current tilt angle in degrees
 * @param tiltConfig - Tilt servo configuration
 * @param containerSize - Size of the square container in pixels
 * @param indicatorRadius - Radius of the position indicator in pixels
 * @returns Tuple of [x, y] coordinates in pixels
 */
export function mapPanTiltToXYSquare(
    panAngle: number,
    panConfig: IServoConfig,
    tiltAngle: number,
    tiltConfig: IServoConfig,
    containerSize: number,
    indicatorRadius: number,
): [number, number] {
    const xf =
        panAngle -
        panConfig.min_angle / panConfig.max_angle -
        panConfig.min_angle;
    const x =
        containerSize -
        (xf * containerSize) / (panConfig.max_angle - panConfig.min_angle);

    const yf =
        tiltAngle -
        tiltConfig.min_angle / tiltConfig.max_angle -
        tiltConfig.min_angle;
    const y =
        (yf * containerSize) / (tiltConfig.max_angle - tiltConfig.min_angle);

    return [x - indicatorRadius, y - indicatorRadius];
}

/**
 * Converts XY coordinates in a square control grid to pan/tilt servo servoAngles.
 *
 * Maps click/touch coordinates from a pan/tilt control interface to the
 * corresponding servo servoAngles. Inverse operation of mapPanTiltToXYSquare.
 *
 * @param x - X coordinate in pixels
 * @param y - Y coordinate in pixels
 * @param panConfig - Pan servo configuration
 * @param tiltConfig - Tilt servo configuration
 * @param containerSize - Size of the square container in pixels
 * @returns Tuple of [panAngle, tiltAngle] in degrees
 *
 * @example
 * ```typescript
 * const [panAngle, tiltAngle] = mapXYToPanTilt(
 *   100, 50,
 *   panConfig, tiltConfig,
 *   200
 * );
 * sendHubStateUpdate({ servo_angles: { pan: panAngle, tilt: tiltAngle } });
 * ```
 */
export function mapXYToPanTilt(
    x: number,
    y: number,
    panConfig: IServoConfig,
    tiltConfig: IServoConfig,
    containerSize: number,
): [number, number] {
    const panAngle =
        panConfig.max_angle -
        (x * (panConfig.max_angle - panConfig.min_angle)) / containerSize;
    const tiltAngle =
        (y * (tiltConfig.max_angle - tiltConfig.min_angle)) / containerSize +
        tiltConfig.min_angle;

    return [panAngle, tiltAngle];
}

export function isTouchEvent(
    e: React.TouchEvent | React.MouseEvent,
): e is React.TouchEvent {
    return e.nativeEvent instanceof TouchEvent;
}
