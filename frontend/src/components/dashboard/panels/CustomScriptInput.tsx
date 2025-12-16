import { useState } from 'react';
import { PenLine, Check, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// Facebook Ad Guidelines
const SCRIPT_LIMITS = {
  primaryText: { max: 125, recommended: 100, label: 'Primary Text' },
  headline: { max: 40, recommended: 27, label: 'Headline' },
  description: { max: 30, recommended: 25, label: 'Description' }
};

interface CustomScriptInputProps {
  onSubmit: (script: { primaryText: string; headline: string; description: string }) => void;
  onCancel: () => void;
}

export const CustomScriptInput = ({ onSubmit, onCancel }: CustomScriptInputProps) => {
  const [primaryText, setPrimaryText] = useState('');
  const [headline, setHeadline] = useState('');
  const [description, setDescription] = useState('');

  const getCharacterStatus = (value: string, limit: typeof SCRIPT_LIMITS.primaryText) => {
    const length = value.length;
    if (length === 0) return 'empty';
    if (length <= limit.recommended) return 'optimal';
    if (length <= limit.max) return 'acceptable';
    return 'exceeded';
  };

  const primaryStatus = getCharacterStatus(primaryText, SCRIPT_LIMITS.primaryText);
  const headlineStatus = getCharacterStatus(headline, SCRIPT_LIMITS.headline);
  const descriptionStatus = getCharacterStatus(description, SCRIPT_LIMITS.description);

  const isValid = primaryText.length > 0 && 
    primaryText.length <= SCRIPT_LIMITS.primaryText.max &&
    headline.length > 0 &&
    headline.length <= SCRIPT_LIMITS.headline.max &&
    description.length <= SCRIPT_LIMITS.description.max;

  const handleSubmit = () => {
    if (isValid) {
      onSubmit({ primaryText, headline, description });
    }
  };

  const CharacterCounter = ({ 
    value, 
    limit, 
    status 
  }: { 
    value: string; 
    limit: typeof SCRIPT_LIMITS.primaryText; 
    status: string;
  }) => (
    <div className="flex items-center justify-between text-xs mt-1">
      <span className={cn(
        "flex items-center gap-1",
        status === 'optimal' && "text-secondary",
        status === 'acceptable' && "text-yellow-500",
        status === 'exceeded' && "text-destructive",
        status === 'empty' && "text-muted-foreground"
      )}>
        {status === 'optimal' && <Check className="w-3 h-3" />}
        {status === 'exceeded' && <AlertCircle className="w-3 h-3" />}
        {value.length}/{limit.max}
      </span>
      {status === 'optimal' && (
        <span className="text-secondary flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          Optimal length
        </span>
      )}
      {status === 'acceptable' && (
        <span className="text-yellow-500">Recommended: {limit.recommended} chars</span>
      )}
      {status === 'exceeded' && (
        <span className="text-destructive">Exceeds limit</span>
      )}
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
          <PenLine className="w-6 h-6 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">Write Your Script</h2>
        <p className="text-sm text-muted-foreground">
          Create custom ad copy following Facebook guidelines
        </p>
      </div>

      {/* Guidelines Card */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <h3 className="text-sm font-medium text-primary mb-2 flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          Facebook Ad Best Practices
        </h3>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• Keep primary text under 125 characters for full visibility</li>
          <li>• Headlines under 40 characters perform best</li>
          <li>• Use clear, action-oriented language</li>
          <li>• Include a compelling value proposition</li>
        </ul>
      </div>

      <div className="space-y-4">
        {/* Primary Text */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Primary Text <span className="text-destructive">*</span>
          </label>
          <Textarea
            value={primaryText}
            onChange={(e) => setPrimaryText(e.target.value)}
            placeholder="The main message of your ad (e.g., 'Transform your morning routine with our premium wireless earbuds...')"
            className={cn(
              "resize-none min-h-[100px]",
              primaryStatus === 'exceeded' && "border-destructive focus-visible:ring-destructive"
            )}
            maxLength={SCRIPT_LIMITS.primaryText.max + 50} // Allow typing over to show error
          />
          <CharacterCounter value={primaryText} limit={SCRIPT_LIMITS.primaryText} status={primaryStatus} />
        </div>

        {/* Headline */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Headline <span className="text-destructive">*</span>
          </label>
          <Textarea
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="A catchy headline (e.g., 'Sound That Moves You')"
            className={cn(
              "resize-none min-h-[60px]",
              headlineStatus === 'exceeded' && "border-destructive focus-visible:ring-destructive"
            )}
            maxLength={SCRIPT_LIMITS.headline.max + 20}
          />
          <CharacterCounter value={headline} limit={SCRIPT_LIMITS.headline} status={headlineStatus} />
        </div>

        {/* Description (Optional) */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Description <span className="text-muted-foreground text-xs">(Optional)</span>
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Additional context (e.g., 'Free shipping today')"
            className={cn(
              "resize-none min-h-[60px]",
              descriptionStatus === 'exceeded' && "border-destructive focus-visible:ring-destructive"
            )}
            maxLength={SCRIPT_LIMITS.description.max + 10}
          />
          <CharacterCounter value={description} limit={SCRIPT_LIMITS.description} status={descriptionStatus} />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          variant="outline"
          onClick={onCancel}
          className="flex-1"
        >
          Back to AI Scripts
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!isValid}
          className="flex-1 bg-secondary hover:bg-secondary/90"
        >
          <Check className="w-4 h-4 mr-2" />
          Use This Script
        </Button>
      </div>
    </div>
  );
};
