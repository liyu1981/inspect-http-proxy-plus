"use client";

import { format, parse } from "date-fns";
import * as React from "react";
import { Input } from "@/components/ui/input";

interface TimeInputProps {
  value?: Date;
  onChange: (date: Date) => void;
  disabled?: boolean;
}

export const TimeInput: React.FC<TimeInputProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const timeStr = value ? format(value, "HH:mm") : "";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) return;
    const newTime = parse(val, "HH:mm", value || new Date());
    if (value) {
      newTime.setFullYear(value.getFullYear());
      newTime.setMonth(value.getMonth());
      newTime.setDate(value.getDate());
    }
    onChange(newTime);
  };

  return (
    <Input
      type="time"
      value={timeStr}
      onChange={handleChange}
      disabled={disabled}
      className="w-full sm:w-[120px]"
    />
  );
};

TimeInput.displayName = "TimeInput";
