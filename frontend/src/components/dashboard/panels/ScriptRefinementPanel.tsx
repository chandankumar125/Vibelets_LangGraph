import { ScriptOption } from '@/types/campaign';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Edit2, Save, X, RefreshCw, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface ScriptRefinementPanelProps {
  selectedScript: ScriptOption | null;
  isRefining?: boolean;
  onRefinedScriptSubmit?: (script: ScriptOption) => void;
  onCancel?: () => void;
}

export const ScriptRefinementPanel = ({
  selectedScript,
  isRefining = false,
  onRefinedScriptSubmit,
  onCancel,
}: ScriptRefinementPanelProps) => {
  const [editMode, setEditMode] = useState(false);
  const [refinedContent, setRefinedContent] = useState(selectedScript?.content || selectedScript?.body || '');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  if (!selectedScript) {
    return (
      <div className="p-6 space-y-4">
        <div className="text-center py-12">
          <p className="text-muted-foreground">No script selected for refinement</p>
        </div>
      </div>
    );
  }

  const handleCopySection = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const handleSaveRefinement = () => {
    if (onRefinedScriptSubmit && refinedContent.trim()) {
      onRefinedScriptSubmit({
        ...selectedScript,
        content: refinedContent,
        body: refinedContent,
        id: 'refined-' + Date.now(),
      });
      setEditMode(false);
    }
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto h-full">
      
      {/* Script Header */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-primary" />
                {selectedScript.name}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">{selectedScript.description}</p>
            </div>
            {onCancel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Script Info */}
          <div className="flex gap-2 mt-3 flex-wrap">
            <Badge variant="secondary">
              <span className="text-xs">Duration: {selectedScript.duration}</span>
            </Badge>
            <Badge variant="outline">
              <span className="text-xs">Style: {selectedScript.style}</span>
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Script Components Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-primary" />
          Script Components
        </h3>

        {/* Hook */}
        {selectedScript.hook && (
          <Card className="hover:border-primary/50 transition-colors">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs">Hook</CardTitle>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    console.log('✅ Copy Hook clicked');
                    handleCopySection(selectedScript.hook || '', 'hook');
                  }}
                >
                  {copiedSection === 'hook' ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{selectedScript.hook}</p>
            </CardContent>
          </Card>
        )}

        {/* Body/Content */}
        {selectedScript.body && (
          <Card className="hover:border-primary/50 transition-colors">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs">Main Content</CardTitle>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    console.log('✅ Copy Body clicked');
                    handleCopySection(selectedScript.body || '', 'body');
                  }}
                >
                  {copiedSection === 'body' ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{selectedScript.body}</p>
            </CardContent>
          </Card>
        )}

        {/* CTA */}
        {selectedScript.cta && (
          <Card className="hover:border-primary/50 transition-colors">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs">Call to Action</CardTitle>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    console.log('✅ Copy CTA clicked');
                    handleCopySection(selectedScript.cta || '', 'cta');
                  }}
                >
                  {copiedSection === 'cta' ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{selectedScript.cta}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit/Refine Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Refine Script</h3>
          <Button
            variant={editMode ? "destructive" : "outline"}
            size="sm"
            onClick={() => {
              if (editMode) {
                setRefinedContent(selectedScript.content || selectedScript.body || '');
              }
              setEditMode(!editMode);
            }}
          >
            {editMode ? (
              <>
                <X className="w-3 h-3 mr-1" />
                Cancel
              </>
            ) : (
              <>
                <Edit2 className="w-3 h-3 mr-1" />
                Edit
              </>
            )}
          </Button>
        </div>

        {editMode ? (
          <div className="space-y-3">
            <Textarea
              value={refinedContent}
              onChange={(e) => setRefinedContent(e.target.value)}
              placeholder="Edit the script content here..."
              className="min-h-[200px] resize-none"
            />
            <Button
              onClick={handleSaveRefinement}
              disabled={isRefining || !refinedContent.trim()}
              className="w-full"
            >
              <Save className={cn("w-4 h-4 mr-2", isRefining && "animate-spin")} />
              {isRefining ? 'Saving...' : 'Save Refinement'}
            </Button>
          </div>
        ) : (
          <Card className="bg-muted/30">
            <CardContent className="pt-4">
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {refinedContent || selectedScript.content || selectedScript.body || 'No content'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Actions */}
      {!editMode && onRefinedScriptSubmit && (
        <div className="flex gap-2 pt-4 z-50 relative">
          <Button
            type="button"
            onClick={() => {
              console.log('✅ Confirm & Continue clicked');
              onRefinedScriptSubmit({
                ...selectedScript,
                content: refinedContent,
                body: refinedContent,
                id: 'refined-' + Date.now(),
              });
            }}
            className="flex-1"
            disabled={isRefining}
          >
            <Check className={cn("w-4 h-4 mr-2", isRefining && "animate-spin")} />
            {isRefining ? 'Confirming...' : 'Confirm & Continue'}
          </Button>
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                console.log('✅ Skip clicked');
                onCancel();
              }}
              className="flex-1"
              disabled={isRefining}
            >
              <X className="w-4 h-4 mr-2" />
              Skip
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
