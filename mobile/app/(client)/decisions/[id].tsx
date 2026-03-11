import { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Clock, AlertTriangle, CheckCircle } from 'lucide-react-native';
import { format, formatDistanceToNow, isPast } from 'date-fns';

import { useDecision, useRespondToDecision } from '@/hooks/use-client-decisions';
import { LoadingSkeleton } from '@/components/layout/loading-skeleton';
import { cn } from '@/lib/utils';
import type { DecisionResponseData, DecisionResponseType } from '@/types/decision';

const TEXT_MAX_LENGTH = 2000;

function RadioOption({
  label,
  description,
  selected,
  onSelect,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Pressable onPress={onSelect} className="flex-row items-start py-3 border-b border-border">
      <View
        className={cn(
          'h-5 w-5 rounded-full border-2 items-center justify-center mt-0.5',
          selected ? 'border-accent' : 'border-muted-foreground',
        )}
      >
        {selected ? <View className="h-2.5 w-2.5 rounded-full bg-accent" /> : null}
      </View>
      <View className="ml-3 flex-1">
        <Text className="text-sm font-medium text-foreground">{label}</Text>
        {description ? (
          <Text className="text-xs text-muted-foreground mt-0.5">{description}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function CheckboxOption({
  label,
  description,
  checked,
  onToggle,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable onPress={onToggle} className="flex-row items-start py-3 border-b border-border">
      <View
        className={cn(
          'h-5 w-5 rounded border-2 items-center justify-center mt-0.5',
          checked ? 'border-accent bg-accent' : 'border-muted-foreground',
        )}
      >
        {checked ? <CheckCircle color="#0f172a" size={14} /> : null}
      </View>
      <View className="ml-3 flex-1">
        <Text className="text-sm font-medium text-foreground">{label}</Text>
        {description ? (
          <Text className="text-xs text-muted-foreground mt-0.5">{description}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function DecisionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: decision, isLoading } = useDecision(id ?? '');
  const respondMutation = useRespondToDecision();

  const [selectedOption, setSelectedOption] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [textResponse, setTextResponse] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = useCallback((): boolean => {
    if (!decision) return false;
    switch (decision.response_type) {
      case 'yes_no':
        return selectedOption === 'yes' || selectedOption === 'no';
      case 'choice':
        return !!selectedOption;
      case 'multi_choice':
        return selectedOptions.length > 0;
      case 'text':
        return textResponse.trim().length > 0;
      default:
        return false;
    }
  }, [decision, selectedOption, selectedOptions, textResponse]);

  const handleSubmit = useCallback(() => {
    if (!decision || !canSubmit()) return;

    Alert.alert('Confirm Response', 'Are you sure you want to submit this response? This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Submit',
        onPress: async () => {
          setIsSubmitting(true);
          try {
            const data: DecisionResponseData = {};

            if (decision.response_type === 'yes_no') {
              data.text = selectedOption;
            } else if (decision.response_type === 'choice') {
              data.option_id = selectedOption;
            } else if (decision.response_type === 'multi_choice') {
              data.text = JSON.stringify(selectedOptions);
            } else if (decision.response_type === 'text') {
              data.text = textResponse.trim();
            }

            await respondMutation.mutateAsync({ id: decision.id, data });
            Alert.alert('Success', 'Your response has been submitted.');
            router.back();
          } catch {
            // Error handled by mutation hook
          } finally {
            setIsSubmitting(false);
          }
        },
      },
    ]);
  }, [decision, canSubmit, selectedOption, selectedOptions, textResponse, respondMutation, router]);

  const toggleMultiOption = useCallback(
    (optionId: string) => {
      setSelectedOptions((prev) =>
        prev.includes(optionId)
          ? prev.filter((o) => o !== optionId)
          : [...prev, optionId],
      );
    },
    [],
  );

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        <View className="p-4">
          <LoadingSkeleton height={28} width="70%" className="mb-3" />
          <LoadingSkeleton height={60} className="mb-3" />
          <LoadingSkeleton height={200} className="mb-3" />
        </View>
      </SafeAreaView>
    );
  }

  if (!decision) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center" edges={['bottom']}>
        <Text className="text-lg text-muted-foreground">Decision not found</Text>
      </SafeAreaView>
    );
  }

  const isResponded = decision.status !== 'pending';
  const isOverdue = decision.deadline_date && isPast(new Date(decision.deadline_date)) && !isResponded;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Header */}
        <View className="px-4 pt-4 pb-2">
          <Text className="text-2xl font-bold text-foreground">{decision.title}</Text>
          <View className="mt-2 flex-row items-center">
            <View
              className={cn(
                'rounded-full px-2.5 py-0.5',
                decision.status === 'pending' ? 'bg-rag-amber/20' : 'bg-green-100',
              )}
            >
              <Text
                className={cn(
                  'text-xs font-medium',
                  decision.status === 'pending' ? 'text-rag-amber' : 'text-green-700',
                )}
              >
                {decision.status.charAt(0).toUpperCase() + decision.status.slice(1)}
              </Text>
            </View>
          </View>
        </View>

        {/* Description */}
        <View className="mx-4 mb-4 rounded-xl border border-border bg-card p-4">
          <Text className="text-sm text-foreground leading-5">{decision.prompt}</Text>
        </View>

        {/* Deadline */}
        {decision.deadline_date ? (
          <View className="mx-4 mb-4 rounded-xl border border-border bg-card p-4 flex-row items-center">
            {isOverdue ? (
              <AlertTriangle color="#ef4444" size={18} />
            ) : (
              <Clock color="#eab308" size={18} />
            )}
            <View className="ml-3">
              <Text className="text-xs text-muted-foreground">Deadline</Text>
              <Text
                className={cn(
                  'text-sm font-medium',
                  isOverdue ? 'text-rag-red' : 'text-foreground',
                )}
              >
                {format(new Date(decision.deadline_date), 'MMM d, yyyy')}
                {decision.deadline_time ? ` at ${decision.deadline_time}` : ''}
              </Text>
              <Text className="text-xs text-muted-foreground">
                {isOverdue
                  ? `Overdue by ${formatDistanceToNow(new Date(decision.deadline_date))}`
                  : formatDistanceToNow(new Date(decision.deadline_date), { addSuffix: true })}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Already Responded - Read-only view */}
        {isResponded && decision.response ? (
          <View className="mx-4 mb-4 rounded-xl border border-green-200 bg-green-50 p-4">
            <View className="flex-row items-center mb-2">
              <CheckCircle color="#22c55e" size={18} />
              <Text className="ml-2 text-sm font-semibold text-green-800">Response Submitted</Text>
            </View>
            <Text className="text-sm text-green-700">
              {decision.response.option_id
                ? `Selected: ${decision.options?.find((o) => o.id === decision.response?.option_id)?.label ?? decision.response.option_id}`
                : decision.response.text ?? 'Response recorded'}
            </Text>
            {decision.response.responded_at ? (
              <Text className="mt-1 text-xs text-green-600">
                Responded {format(new Date(decision.response.responded_at), 'MMM d, yyyy h:mm a')}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* Response Input — only for pending decisions */}
        {!isResponded ? (
          <View className="mx-4 mb-4">
            <Text className="text-base font-semibold text-foreground mb-3">Your Response</Text>

            {decision.response_type === 'yes_no' ? (
              <View className="rounded-xl border border-border bg-card px-4">
                <RadioOption
                  label="Yes"
                  selected={selectedOption === 'yes'}
                  onSelect={() => setSelectedOption('yes')}
                />
                <RadioOption
                  label="No"
                  selected={selectedOption === 'no'}
                  onSelect={() => setSelectedOption('no')}
                />
              </View>
            ) : null}

            {decision.response_type === 'choice' && decision.options ? (
              <View className="rounded-xl border border-border bg-card px-4">
                {decision.options.map((option) => (
                  <RadioOption
                    key={option.id}
                    label={option.label}
                    description={option.description}
                    selected={selectedOption === option.id}
                    onSelect={() => setSelectedOption(option.id)}
                  />
                ))}
              </View>
            ) : null}

            {decision.response_type === 'multi_choice' && decision.options ? (
              <View className="rounded-xl border border-border bg-card px-4">
                {decision.options.map((option) => (
                  <CheckboxOption
                    key={option.id}
                    label={option.label}
                    description={option.description}
                    checked={selectedOptions.includes(option.id)}
                    onToggle={() => toggleMultiOption(option.id)}
                  />
                ))}
              </View>
            ) : null}

            {decision.response_type === 'text' ? (
              <View className="rounded-xl border border-border bg-card p-4">
                <TextInput
                  className="text-sm text-foreground min-h-[100px]"
                  placeholder="Enter your response..."
                  placeholderTextColor="#94a3b8"
                  value={textResponse}
                  onChangeText={setTextResponse}
                  multiline
                  textAlignVertical="top"
                  maxLength={TEXT_MAX_LENGTH}
                />
                <Text className="text-xs text-muted-foreground text-right mt-1">
                  {textResponse.length}/{TEXT_MAX_LENGTH}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Consequence Warning */}
        {decision.consequence_text && !isResponded ? (
          <View className="mx-4 mb-4 rounded-xl bg-rag-amber/10 p-4">
            <Text className="text-sm font-bold text-rag-amber">⚠ If no response is given:</Text>
            <Text className="mt-1 text-sm text-foreground">{decision.consequence_text}</Text>
          </View>
        ) : null}

        {/* Submit Button */}
        {!isResponded ? (
          <View className="px-4">
            <Pressable
              onPress={handleSubmit}
              disabled={!canSubmit() || isSubmitting}
              className={cn(
                'rounded-lg py-3.5 items-center',
                canSubmit() && !isSubmitting ? 'bg-accent' : 'bg-muted',
              )}
            >
              <Text
                className={cn(
                  'text-base font-semibold',
                  canSubmit() && !isSubmitting ? 'text-accent-foreground' : 'text-muted-foreground',
                )}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Response'}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
