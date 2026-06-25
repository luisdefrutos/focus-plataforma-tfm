export const TsIcon = (props: any) => {
  const { name, className, style, size, ...rest } = props;
  
  // En el mock, si le pasan --icon-color en style, lo forzamos a ser el color del texto
  const iconColor = style && (style as any)['--icon-color'];
  
  return (
    <span 
      className={`material-symbols-outlined ${className || ''}`} 
      style={{ 
        fontSize: size ? `${size}px` : undefined, 
        color: iconColor,
        ...style 
      }} 
      {...rest}
    >
      {name}
    </span>
  );
};
