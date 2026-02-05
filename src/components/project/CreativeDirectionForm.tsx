import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Save, Loader2 } from 'lucide-react';

interface CreativeDirectionFormProps {
  styleDirection: string;
  animationDirection: string;
  cinematographyDirection: string;
  onSave: (data: {
    style_direction: string;
    animation_direction: string;
    cinematography_direction: string;
    creative_brief: string;
  }) => Promise<void>;
  isSaving?: boolean;
  showSaveButton?: boolean;
  onChange?: (data: {
    style_direction: string;
    animation_direction: string;
    cinematography_direction: string;
    creative_brief: string;
  }) => void;
}

function buildCreativeBrief(
  style: string,
  animation: string,
  cinematography: string
): string {
  const parts: string[] = [];
  if (style.trim()) parts.push(`Style: ${style.trim()}`);
  if (animation.trim()) parts.push(`Motion: ${animation.trim()}`);
  if (cinematography.trim()) parts.push(`Camera: ${cinematography.trim()}`);
  return parts.join('. ') + (parts.length > 0 ? '.' : '');
}

export function CreativeDirectionForm({
  styleDirection,
  animationDirection,
  cinematographyDirection,
  onSave,
  isSaving = false,
  showSaveButton = true,
  onChange,
}: CreativeDirectionFormProps) {
  const [style, setStyle] = useState(styleDirection);
  const [animation, setAnimation] = useState(animationDirection);
  const [cinematography, setCinematography] = useState(cinematographyDirection);

  useEffect(() => {
    setStyle(styleDirection);
    setAnimation(animationDirection);
    setCinematography(cinematographyDirection);
  }, [styleDirection, animationDirection, cinematographyDirection]);

  const handleChange = (field: 'style' | 'animation' | 'cinematography', value: string) => {
    const newStyle = field === 'style' ? value : style;
    const newAnimation = field === 'animation' ? value : animation;
    const newCinematography = field === 'cinematography' ? value : cinematography;

    if (field === 'style') setStyle(value);
    if (field === 'animation') setAnimation(value);
    if (field === 'cinematography') setCinematography(value);

    if (onChange) {
      onChange({
        style_direction: newStyle,
        animation_direction: newAnimation,
        cinematography_direction: newCinematography,
        creative_brief: buildCreativeBrief(newStyle, newAnimation, newCinematography),
      });
    }
  };

  const handleSave = async () => {
    await onSave({
      style_direction: style,
      animation_direction: animation,
      cinematography_direction: cinematography,
      creative_brief: buildCreativeBrief(style, animation, cinematography),
    });
  };

  const isValid = style.trim().length > 0 && animation.trim().length > 0;

  return (
    <Card className="card-shadow">
      <CardHeader>
        <CardTitle>Creative Direction</CardTitle>
        <CardDescription>
          These guide all AI-generated images and videos in this project. Set once, applied everywhere.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="style">Visual Style *</Label>
          <Input
            id="style"
            value={style}
            onChange={(e) => handleChange('style', e.target.value)}
            placeholder="e.g. felted wool characters, watercolor, pixel art, claymation"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="animation">Animation Feel *</Label>
          <Input
            id="animation"
            value={animation}
            onChange={(e) => handleChange('animation', e.target.value)}
            placeholder="e.g. stop-motion, slow and dreamy, energetic, hand-drawn"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cinematography">Cinematography Notes</Label>
          <Textarea
            id="cinematography"
            value={cinematography}
            onChange={(e) => handleChange('cinematography', e.target.value)}
            placeholder="e.g. vary shot distances, not every scene needs characters, cinematic framing"
            className="min-h-[80px]"
          />
        </div>

        {showSaveButton && (
          <Button
            onClick={handleSave}
            disabled={!isValid || isSaving}
            className="w-full gap-2"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isSaving ? 'Saving...' : 'Save Creative Direction'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
