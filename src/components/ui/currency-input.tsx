import * as React from "react";

import { Input } from "@/components/ui/input";
import { formatCurrencyInput } from "@/lib/masks";

type CurrencyInputProps = Omit<React.ComponentProps<typeof Input>, "onChange" | "value"> & {
  value: string;
  onValueChange: (value: string) => void;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onValueChange, onChange, inputMode, ...props }, ref) => {
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatCurrencyInput(event.target.value);
      onValueChange(formatted);
      onChange?.(event);
    };

    return (
      <Input
        {...props}
        ref={ref}
        value={value}
        onChange={handleChange}
        inputMode={inputMode || "decimal"}
      />
    );
  },
);
CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };
