"use client";

import { Minimize2, Sparkles } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Corner = "topLeft" | "topRight" | "bottomLeft" | "bottomRight";

function calculateCornerPosition(
  corner: Corner,
  popupWidth: number,
  popupHeight: number,
) {
  const isScrollbarVisible =
    document.body.scrollHeight > document.documentElement.clientHeight;

  const fixPadding = 8;
  const extraPadding = isScrollbarVisible ? fixPadding : 0;
  const viewportWidth = document.documentElement.clientWidth;

  switch (corner) {
    case "topLeft":
      return { x: fixPadding, y: fixPadding };
    case "topRight":
      return {
        x: viewportWidth - popupWidth - fixPadding - extraPadding,
        y: fixPadding,
      };
    case "bottomLeft":
      return {
        x: fixPadding,
        y: window.innerHeight - popupHeight - fixPadding,
      };
    case "bottomRight":
      return {
        x: viewportWidth - popupWidth - fixPadding - extraPadding,
        y: window.innerHeight - popupHeight - fixPadding,
      };
  }
}

interface FloatPopupProps {
  minimized?: React.ReactNode;
  children: React.ReactNode;
}

export const FloatPopup: React.FC<FloatPopupProps> = ({
  minimized,
  children,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [snapCorner, setSnapCorner] = useState<Corner>("bottomRight");

  const nodeRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dragStateRef = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
  });

  useEffect(() => {
    setIsClient(true);
    const setInitialPosition = () => {
      if (nodeRef.current) {
        const popupWidth = 48;
        const popupHeight = 48;
        setPosition(
          calculateCornerPosition("bottomRight", popupWidth, popupHeight),
        );
      } else {
        setTimeout(setInitialPosition, 50);
      }
    };
    setInitialPosition();
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: isExpanded helps to update position when expand the popup
  useEffect(() => {
    if (!isClient || !nodeRef.current) return;
    const { width, height } = nodeRef.current.getBoundingClientRect();
    setPosition(calculateCornerPosition(snapCorner, width, height));
  }, [isExpanded, isClient, snapCorner]);

  useEffect(() => {
    const handleResize = () => {
      if (nodeRef.current) {
        const { width, height } = nodeRef.current.getBoundingClientRect();
        setPosition(calculateCornerPosition(snapCorner, width, height));
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [snapCorner]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isExpanded) return;

    e.preventDefault();
    e.stopPropagation();

    const rect = nodeRef.current!.getBoundingClientRect();
    dragStateRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragStateRef.current.isDragging) return;

    const newX = e.clientX - dragStateRef.current.offsetX;
    const newY = e.clientY - dragStateRef.current.offsetY;

    setPosition({ x: newX, y: newY });
  };

  const handleMouseUp = (e: MouseEvent) => {
    if (!dragStateRef.current.isDragging) return;

    const movedDistance =
      Math.abs(e.clientX - dragStateRef.current.startX) +
      Math.abs(e.clientY - dragStateRef.current.startY);

    if (movedDistance > 5 && nodeRef.current) {
      const { width, height } = nodeRef.current.getBoundingClientRect();
      const currentX = e.clientX - dragStateRef.current.offsetX;
      const currentY = e.clientY - dragStateRef.current.offsetY;

      const corners = {
        topLeft: calculateCornerPosition("topLeft", width, height),
        topRight: calculateCornerPosition("topRight", width, height),
        bottomLeft: calculateCornerPosition("bottomLeft", width, height),
        bottomRight: calculateCornerPosition("bottomRight", width, height),
      };

      const distances = {
        topLeft:
          Math.abs(currentX - corners.topLeft.x) +
          Math.abs(currentY - corners.topLeft.y),
        topRight:
          Math.abs(currentX - corners.topRight.x) +
          Math.abs(currentY - corners.topRight.y),
        bottomLeft:
          Math.abs(currentX - corners.bottomLeft.x) +
          Math.abs(currentY - corners.bottomLeft.y),
        bottomRight:
          Math.abs(currentX - corners.bottomRight.x) +
          Math.abs(currentY - corners.bottomRight.y),
      };

      let closestCorner: Corner = "bottomRight";
      let minDistance = Infinity;

      for (const cornerKey in distances) {
        if (distances[cornerKey as Corner] < minDistance) {
          minDistance = distances[cornerKey as Corner];
          closestCorner = cornerKey as Corner;
        }
      }

      setSnapCorner(closestCorner);
      setPosition(calculateCornerPosition(closestCorner, width, height));
    } else if (movedDistance <= 5) {
      // It was a click, not a drag
      setIsExpanded(true);
    }

    dragStateRef.current.isDragging = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  const toggleExpansion = () => {
    setIsExpanded(!isExpanded);
  };

  const getMinimizeButtonClasses = () => {
    let classes = "absolute z-50";
    switch (snapCorner) {
      case "topLeft":
        classes += " top-[4px] right-[4px]";
        break;
      case "topRight":
        classes += " top-[4px] right-[4px]";
        break;
      case "bottomLeft":
        classes += " top-[4px] right-[4px]";
        break;
      case "bottomRight":
        classes += " top-[4px] right-[4px]";
        break;
      default:
        classes += " top-[4px] right-[4px]"; // Fallback
    }
    return classes;
  };

  if (!isClient) return null;

  return (
    <div
      ref={nodeRef}
      style={{
        position: "fixed",
        zIndex: 50,
        left: position.x,
        top: position.y,
      }}
    >
      {isExpanded ? (
        <Card className="w-[50vw] h-[70vh] shadow-2xl max-w-[50vw] max-h-[70vh] flex flex-col relative">
          <Button
            size="icon"
            onClick={toggleExpansion}
            className={`${getMinimizeButtonClasses()} bg-white hover:bg-slate-200 text-black shadow-2xl `}
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
          <CardContent className="flex-1 p-0">
            <div className="flex flex-col divide-y h-full">{children}</div>
          </CardContent>
        </Card>
      ) : (
        <Button
          ref={buttonRef}
          className="w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-white"
          style={{
            cursor: dragStateRef.current.isDragging ? "grabbing" : "grab",
          }}
          onMouseDown={handleMouseDown}
        >
          {minimized || <Sparkles className="h-4 w-4" />}
        </Button>
      )}
    </div>
  );
};
