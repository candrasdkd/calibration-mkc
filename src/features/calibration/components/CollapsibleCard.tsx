import React, { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Card, DisclosureChevron } from '../../../components/ui';
import { styles } from '../styles/CalibrationScreenStyles';

export function CollapsibleCard({ title, hint, children }: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  return <Card>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded((value) => !value)} style={styles.accordionHeader}>
      <View style={styles.accordionCopy}>
        <Text style={styles.accordionTitle}>{title}</Text>
        {hint ? <Text style={styles.accordionHint}>{hint}</Text> : null}
      </View>
      <DisclosureChevron expanded={expanded} />
    </Pressable>
    {expanded ? <View style={styles.accordionBody}>{children}</View> : null}
  </Card>;
}
