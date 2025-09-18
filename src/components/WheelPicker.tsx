import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface WheelPickerProps {
  options: (string | number)[];
  value: string | number;
  onChange: (value: string | number) => void;
  className?: string;
  height?: number;
}

export const WheelPicker = ({ 
  options, 
  value, 
  onChange, 
  className = "",
  height = 200 
}: WheelPickerProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemHeight = 40;
  const visibleItems = Math.floor(height / itemHeight);
  const centerIndex = Math.floor(visibleItems / 2);

  useEffect(() => {
    const index = options.findIndex(option => option === value);
    if (index !== -1) {
      setSelectedIndex(index);
    }
  }, [value, options]);

  const handleScroll = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 1 : -1;
    const newIndex = Math.max(0, Math.min(options.length - 1, selectedIndex + delta));
    
    if (newIndex !== selectedIndex) {
      setSelectedIndex(newIndex);
      onChange(options[newIndex]);
    }
  };

  const handleItemClick = (index: number) => {
    setSelectedIndex(index);
    onChange(options[index]);
  };

  return (
    <div 
      ref={containerRef}
      className={cn("relative overflow-hidden select-none", className)}
      style={{ height }}
      onWheel={handleScroll}
    >
      {/* Gradient overlay top */}
      <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-white to-transparent z-10 pointer-events-none" />
      
      {/* Gradient overlay bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent z-10 pointer-events-none" />
      
      {/* Selected item highlight */}
      <div 
        className="absolute left-0 right-0 bg-orange-100 border-y border-orange-200"
        style={{
          top: centerIndex * itemHeight,
          height: itemHeight
        }}
      />
      
      {/* Items container */}
      <div 
        className="relative"
        style={{
          transform: `translateY(${(centerIndex - selectedIndex) * itemHeight}px)`,
          transition: 'transform 0.3s ease-out'
        }}
      >
        {options.map((option, index) => {
          const distance = Math.abs(index - selectedIndex);
          const isSelected = index === selectedIndex;
          const opacity = Math.max(0.3, 1 - (distance * 0.3));
          const scale = Math.max(0.8, 1 - (distance * 0.1));
          
          return (
            <div
              key={index}
              className={cn(
                "flex items-center justify-center cursor-pointer transition-all duration-300",
                isSelected ? "font-bold text-orange-600" : "text-gray-600"
              )}
              style={{
                height: itemHeight,
                opacity,
                transform: `scale(${scale})`
              }}
              onClick={() => handleItemClick(index)}
            >
              {option}
            </div>
          );
        })}
      </div>
    </div>
  );
};