"use client";

import { format, parse } from "date-fns";
import * as React from "react";
import { Input } from "@/components/ui/input";

interface DateInputProps {
  value?: Date;
  onChange: (date: Date) => void;
  disabled?: boolean;
}

export const DateInput: React.FC<DateInputProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const dateStr = value ? format(value, "yyyy-MM-dd") : "";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) return;
    const newDate = parse(val, "yyyy-MM-dd", new Date());
    if (value) {
      newDate.setHours(
        value.getHours(),
        value.getMinutes(),
        value.getSeconds(),
        value.getMilliseconds(),
      );
    }
    onChange(newDate);
  };

  return (
    <Input
      type="date"
      value={dateStr}
      onChange={handleChange}
      disabled={disabled}
      className="w-full sm:w-[150px]"
    />
  );
};

DateInput.displayName = "DateInput";
