import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import React from 'react';

export const TsTabGroup = (props: any) => {
  const { children, defaultValue, ...rest } = props;
  
  // separate tabs from panels
  const tabs = React.Children.toArray(children).filter((c: any) => c.type?.name === 'TsTab' || c.props?.slot === 'nav');
  const panels = React.Children.toArray(children).filter((c: any) => c.type?.name === 'TsTabPanel' || c.props?.name);

  const firstTabVal = tabs[0] ? ((tabs[0] as any).props.panel || (tabs[0] as any).props.value) : undefined;
  const activeVal = defaultValue || firstTabVal;

  return (
    <Tabs defaultValue={activeVal} className="w-full" {...rest}>
      <TabsList className="mb-4">
        {tabs}
      </TabsList>
      {panels}
    </Tabs>
  );
};
