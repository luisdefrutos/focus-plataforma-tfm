import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from "@/components/ui/dropdown-menu"
import React from 'react';

export const TsDropdown = (props: any) => {
  const { children, placement, distance, ...rest } = props;
  
  const triggerArray = React.Children.toArray(children).filter((c: any) => c?.props?.slot === 'trigger');
  const menuArray = React.Children.toArray(children).filter((c: any) => c?.props?.slot !== 'trigger');

  const trigger = triggerArray[0] as React.ReactElement;
  const isButton = trigger?.type === 'button' || typeof trigger?.type === 'string';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger 
        className={(trigger?.props as any)?.className} 
        style={(trigger?.props as any)?.style}
        {...(trigger?.props as any)}
      >
        {(trigger?.props as any)?.children || trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={distance || 4} {...rest}>
        {menuArray}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
