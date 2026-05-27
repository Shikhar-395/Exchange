"use client";
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@repo/ui/lib/utils";

type Direction = "TOP" | "LEFT" | "BOTTOM" | "RIGHT";

interface HoverBorderGradientProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  as?: React.ElementType;
  containerClassName?: string;
  className?: string;
  duration?: number;
  clockwise?: boolean;
  variant?: "buy" | "sell" | "default";
}

export function HoverBorderGradient({
  children,
  containerClassName,
  className,
  as: Tag = "button",
  duration = 1,
  clockwise = true,
  variant = "default",
  disabled,
  ...props
}: HoverBorderGradientProps) {
  const [hovered, setHovered] = useState<boolean>(false);
  const [direction, setDirection] = useState<Direction>("TOP");

  const rotateDirection = (currentDirection: Direction): Direction => {
    const directions: Direction[] = ["TOP", "LEFT", "BOTTOM", "RIGHT"];
    const currentIndex = directions.indexOf(currentDirection);
    const nextIndex = clockwise
      ? (currentIndex - 1 + directions.length) % directions.length
      : (currentIndex + 1) % directions.length;
    return directions[nextIndex] as Direction;
  };

  useEffect(() => {
    if (!hovered || disabled) return;
    const interval = setInterval(
      () => {
        setDirection((prevState) => rotateDirection(prevState));
      },
      (duration * 1000) / 4,
    );
    return () => clearInterval(interval);
  }, [hovered, duration, clockwise, disabled]);

  // Color mapping based on variant
  const colorMap = {
    buy: "#0fd19a",
    sell: "#ff4d5e",
    default: "#4c96ff",
  };

  const activeColor = colorMap[variant];
  const movingMap = getGradients(activeColor);

  return (
    <Tag
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={disabled}
      className={cn(
        "relative flex content-center bg-white/5 transition duration-500 items-center justify-center p-[1px] decoration-clone overflow-hidden cursor-pointer",
        disabled && "opacity-50 cursor-not-allowed",
        containerClassName,
      )}
      {...props}
    >
      <div
        className={cn(
          "w-full h-full text-center z-10 transition duration-300",
          className,
        )}
      >
        {children}
      </div>

      {/* Moving gradient border */}
      {!disabled && (
        <motion.div
          className="absolute inset-0 overflow-hidden z-0"
          style={{
            filter: "blur(1px)",
            position: "absolute",
            width: "100%",
            height: "100%",
          }}
          animate={{
            background: hovered
              ? [movingMap[direction], movingMap[rotateDirection(direction)]]
              : movingMap[direction],
          }}
          transition={{ ease: "linear", duration: duration / 4 }}
        />
      )}

      {/* Background highlight glow when hovered */}
      {!disabled && hovered && (
        <motion.div
          className="absolute inset-0 z-0 pointer-events-none"
          style={{
            background: `radial-gradient(60% 120% at 50% 50%, ${activeColor}0f 0%, rgba(0, 0, 0, 0) 100%)`,
          }}
        />
      )}
    </Tag>
  );
}

const getGradients = (color: string) => ({
  TOP: `radial-gradient(35% 60% at 50% 0%, ${color} 0%, rgba(0, 0, 0, 0) 100%)`,
  LEFT: `radial-gradient(25% 60% at 0% 50%, ${color} 0%, rgba(0, 0, 0, 0) 100%)`,
  BOTTOM: `radial-gradient(35% 60% at 50% 100%, ${color} 0%, rgba(0, 0, 0, 0) 100%)`,
  RIGHT: `radial-gradient(25% 60% at 100% 50%, ${color} 0%, rgba(0, 0, 0, 0) 100%)`,
});
