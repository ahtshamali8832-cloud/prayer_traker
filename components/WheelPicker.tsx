import { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ListRenderItemInfo,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const ITEM_HEIGHT = 40;
const VISIBLE_COUNT = 5;
export const WHEEL_PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_COUNT;
export { ITEM_HEIGHT };

export interface WheelPickerHandle {
  getIndex: () => number;
}

interface WheelPickerProps {
  data: string[];
  selectedIndex: number;
  onValueChange: (index: number) => void;
  pairSide?: 'left' | 'right';
  accentColor: string;
  textColor: string;
  mutedColor: string;
  backgroundColor: string;
  isItemDisabled?: (index: number) => boolean;
}

function nearestEnabledIndex(
  index: number,
  length: number,
  isItemDisabled?: (index: number) => boolean
): number {
  if (!isItemDisabled?.(index)) return index;
  for (let offset = 1; offset < length; offset++) {
    const below = index + offset;
    if (below < length && !isItemDisabled(below)) return below;
    const above = index - offset;
    if (above >= 0 && !isItemDisabled(above)) return above;
  }
  return index;
}

export const WheelPicker = forwardRef<WheelPickerHandle, WheelPickerProps>(function WheelPicker(
  {
    data,
    selectedIndex,
    onValueChange,
    pairSide,
    accentColor,
    textColor,
    mutedColor,
    backgroundColor,
    isItemDisabled,
  },
  ref
) {
  const listRef = useRef<FlatList<string>>(null);
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const activeIndexRef = useRef(selectedIndex);
  const onValueChangeRef = useRef(onValueChange);

  useEffect(() => {
    onValueChangeRef.current = onValueChange;
  }, [onValueChange]);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useImperativeHandle(ref, () => ({
    getIndex: () => activeIndexRef.current,
  }));

  useEffect(() => {
    setActiveIndex(selectedIndex);
    activeIndexRef.current = selectedIndex;
    listRef.current?.scrollToOffset({
      offset: selectedIndex * ITEM_HEIGHT,
      animated: false,
    });
  }, [selectedIndex]);

  const finishScroll = useCallback(
    (y: number) => {
      const rawIndex = Math.round(y / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(data.length - 1, rawIndex));
      const resolved = nearestEnabledIndex(clamped, data.length, isItemDisabled);
      setActiveIndex(resolved);
      activeIndexRef.current = resolved;
      onValueChangeRef.current(resolved);
      listRef.current?.scrollToOffset({
        offset: resolved * ITEM_HEIGHT,
        animated: resolved !== clamped,
      });
    },
    [data.length, isItemDisabled]
  );

  const itemSideStyle =
    pairSide === 'left' ? styles.itemLeft : pairSide === 'right' ? styles.itemRight : undefined;

  const renderItem = ({ item, index }: ListRenderItemInfo<string>) => {
    const distance = Math.abs(index - activeIndex);
    const opacity = distance === 0 ? 1 : distance === 1 ? 0.65 : distance === 2 ? 0.38 : 0.2;
    const isSelected = index === activeIndex;
    const disabled = isItemDisabled?.(index);

    return (
      <View style={[styles.item, itemSideStyle]}>
        <Text
          style={[
            styles.itemText,
            isSelected
              ? { color: accentColor, fontSize: 17, fontWeight: '700', opacity: 1 }
              : {
                  color: disabled ? mutedColor : textColor,
                  fontSize: 15,
                  fontWeight: '500',
                  opacity: disabled ? 0.3 : opacity,
                },
          ]}
          numberOfLines={1}>
          {item}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={(item, index) => `${item}-${index}`}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        nestedScrollEnabled
        bounces={false}
        contentContainerStyle={styles.listContent}
        onScroll={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
          if (index >= 0 && index < data.length && index !== activeIndex) {
            setActiveIndex(index);
            activeIndexRef.current = index;
          }
        }}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => finishScroll(e.nativeEvent.contentOffset.y)}
        onScrollEndDrag={(e) => finishScroll(e.nativeEvent.contentOffset.y)}
        getItemLayout={(_, index) => ({
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * index,
          index,
        })}
        extraData={activeIndex}
      />
    </View>
  );
});

interface MonthYearWheelPickerProps {
  months: string[];
  years: string[];
  monthIndex: number;
  yearIndex: number;
  onMonthChange: (index: number) => void;
  onYearChange: (index: number) => void;
  isMonthDisabled?: (index: number) => boolean;
  accentColor: string;
  textColor: string;
  mutedColor: string;
  backgroundColor: string;
}

export interface MonthYearWheelPickerHandle {
  getMonthIndex: () => number;
  getYearIndex: () => number;
}

export const MonthYearWheelPicker = forwardRef<MonthYearWheelPickerHandle, MonthYearWheelPickerProps>(
  function MonthYearWheelPicker(
    {
      months,
      years,
      monthIndex,
      yearIndex,
      onMonthChange,
      onYearChange,
      isMonthDisabled,
      accentColor,
      textColor,
      mutedColor,
      backgroundColor,
    },
    ref
  ) {
    const monthRef = useRef<WheelPickerHandle>(null);
    const yearRef = useRef<WheelPickerHandle>(null);

    useImperativeHandle(ref, () => ({
      getMonthIndex: () => monthRef.current?.getIndex() ?? monthIndex,
      getYearIndex: () => yearRef.current?.getIndex() ?? yearIndex,
    }));

    return (
      <View style={styles.pairWrap}>
        <View style={styles.pairRow}>
          <WheelPicker
            ref={monthRef}
            data={months}
            selectedIndex={monthIndex}
            onValueChange={onMonthChange}
            pairSide="left"
            accentColor={accentColor}
            textColor={textColor}
            mutedColor={mutedColor}
            backgroundColor={backgroundColor}
            isItemDisabled={isMonthDisabled}
          />
          <WheelPicker
            ref={yearRef}
            data={years}
            selectedIndex={yearIndex}
            onValueChange={onYearChange}
            pairSide="right"
            accentColor={accentColor}
            textColor={textColor}
            mutedColor={mutedColor}
            backgroundColor={backgroundColor}
          />
        </View>
        <LinearGradient
          colors={[backgroundColor, 'transparent']}
          style={styles.sharedFadeTop}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['transparent', backgroundColor]}
          style={styles.sharedFadeBottom}
          pointerEvents="none"
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: WHEEL_PICKER_HEIGHT,
    overflow: 'hidden',
  },
  listContent: {
    paddingVertical: ITEM_HEIGHT * 2,
  },
  item: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  itemLeft: {
    alignItems: 'flex-end',
    paddingRight: 12,
  },
  itemRight: {
    alignItems: 'flex-start',
    paddingLeft: 12,
  },
  itemText: {
    includeFontPadding: false,
  },
  pairWrap: {
    height: WHEEL_PICKER_HEIGHT,
    position: 'relative',
  },
  pairRow: {
    flexDirection: 'row',
    height: WHEEL_PICKER_HEIGHT,
    gap: 24,
  },
  sharedFadeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT * 1.6,
  },
  sharedFadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT * 1.6,
  },
});
