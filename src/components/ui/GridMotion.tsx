import { useEffect, useMemo, useRef, type FC, type ReactNode } from 'react';
import { gsap } from 'gsap';

interface GridMotionProps {
  items?: (string | ReactNode)[];
  gradientColor?: string;
}

const totalItems = 28;

function shuffleItems<T>(items: T[]) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled;
}

function isImageSource(content: string) {
  return /^(https?:|blob:|data:image\/|\/)/.test(content);
}

const GridMotion: FC<GridMotionProps> = ({ items = [], gradientColor = 'black' }) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const motionProgressRef = useRef(0);

  const combinedItems = useMemo(() => {
    const defaultItems = Array.from({ length: totalItems }, (_, index) => `Item ${index + 1}`);

    if (items.length === 0) {
      return defaultItems;
    }

    const shuffledItems = shuffleItems(items);

    return Array.from({ length: totalItems }, (_, index) => shuffledItems[index % shuffledItems.length]);
  }, [items]);

  useEffect(() => {
    gsap.ticker.lagSmoothing(0);

    const updateMotion = (_time: number, deltaTime: number): void => {
      const maxMoveAmount = 340;
      const rowSpeedFactors = [0.75, 1, 0.62, 0.9];

      motionProgressRef.current += deltaTime / 1000;

      rowRefs.current.forEach((row, index) => {
        if (row) {
          const direction = index % 2 === 0 ? 1 : -1;
          const speed = rowSpeedFactors[index % rowSpeedFactors.length];
          const wave = Math.sin(motionProgressRef.current * speed);
          const drift = Math.sin(motionProgressRef.current * speed * 0.34 + index) * 42;
          const moveAmount = (wave * maxMoveAmount + drift) * direction;

          gsap.to(row, {
            x: moveAmount,
            duration: 1.4,
            ease: 'sine.inOut',
            overwrite: 'auto'
          });
        }
      });
    };

    gsap.ticker.add(updateMotion);

    return () => {
      gsap.ticker.remove(updateMotion);
    };
  }, []);

  return (
    <div ref={gridRef} className="h-full w-full overflow-hidden">
      <section
        className="w-full h-screen overflow-hidden relative flex items-center justify-center"
        style={{
          background: `radial-gradient(circle, ${gradientColor} 0%, transparent 100%)`
        }}
      >
        <div className="absolute inset-0 pointer-events-none z-[4] bg-[length:250px]"></div>
        <div className="grid-motion-board gap-4 flex-none relative grid grid-rows-4 grid-cols-1 origin-center z-[2]">
          {Array.from({ length: 4 }, (_, rowIndex) => (
            <div
              key={rowIndex}
              className="grid-motion-row grid gap-4 grid-cols-7"
              style={{ willChange: 'transform, filter' }}
              ref={el => {
                if (el) rowRefs.current[rowIndex] = el;
              }}
            >
              {Array.from({ length: 7 }, (_, itemIndex) => {
                const content = combinedItems[rowIndex * 7 + itemIndex];
                return (
                  <div key={itemIndex} className="grid-motion-cell relative">
                    <div className="relative w-full h-full overflow-hidden rounded-[10px] bg-[#111] flex items-center justify-center text-white text-[1.5rem]">
                      {typeof content === 'string' && isImageSource(content) ? (
                        <div
                          className="w-full h-full bg-cover bg-center absolute top-0 left-0"
                          style={{ backgroundImage: `url(${content})` }}
                        ></div>
                      ) : (
                        <div className="p-4 text-center z-[1]">{content}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="relative w-full h-full top-0 left-0 pointer-events-none"></div>
      </section>
    </div>
  );
};

export default GridMotion;
