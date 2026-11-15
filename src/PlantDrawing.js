import { memo } from 'react';
import Svg, { Path } from 'react-native-svg';

import { PLANT_BOX, plantForNote } from './botany';
import { INK, LINE } from './theme';

/**
 * The still drawing of the plant for a note: tinted leaves and petals with an
 * ink outline, seen from above. It never changes once drawn. Anything that
 * moves is a view wrapped around it.
 */
function PlantDrawing({ note, size = PLANT_BOX }) {
  // The line keeps its weight on the page however large the plant is drawn.
  const line = (LINE * PLANT_BOX) / size;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${PLANT_BOX} ${PLANT_BOX}`}>
      {plantForNote(note).map((mark, index) => (
        <Path
          key={index}
          d={mark.d}
          fill={mark.fill}
          stroke={mark.weight ? INK : 'none'}
          strokeWidth={line * mark.weight}
          strokeOpacity={mark.opacity}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}

export default memo(PlantDrawing);
