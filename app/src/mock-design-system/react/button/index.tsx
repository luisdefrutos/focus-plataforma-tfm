import { Button } from "@/components/ui/button"

import { Loader2 } from "lucide-react"

export const TsButton = (props: any) => {
  const { variant, children, loading, disabled, ...rest } = props;
  // Map custom variants to Shadcn variants
  let shadcnVariant = variant;
  if (variant === 'primary') shadcnVariant = 'default';
  
  return (
    <Button variant={shadcnVariant} disabled={disabled || loading} {...rest}>
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </Button>
  );
};
