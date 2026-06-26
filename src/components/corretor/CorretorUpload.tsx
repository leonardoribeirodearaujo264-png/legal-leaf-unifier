import { useState, useCallback, useRef } from 'react';
import { Upload, FileText, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

interface CorretorUploadProps {
  onAnalyze: (fileBase64: string, fileName: string) => void;
  isAnalyzing: boolean;
  progress: number;
}

const MAX_SIZE = 100 * 1024 * 1024; // 100MB
const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export function CorretorUpload({ onAnalyze, isAnalyzing, progress }: CorretorUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = (f: File): boolean => {
    if (!ACCEPTED_TYPES.includes(f.type)) {
      toast.error('Formato não suportado. Envie um PDF ou DOCX.');
      return false;
    }
    if (f.size > MAX_SIZE) {
      toast.error('Arquivo muito grande. O limite é 100MB.');
      return false;
    }
    return true;
  };

  const handleFile = (f: File) => {
    if (validateFile(f)) setFile(f);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const handleAnalyze = async () => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      onAnalyze(base64, file.name);
    };
    reader.readAsDataURL(file);
  };

  const ext = file?.name.split('.').pop()?.toUpperCase() || '';

  return (
    <Card>
      <CardContent className="pt-6">
        {!file ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
              dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
          >
            <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium">Arraste um arquivo ou clique para selecionar</p>
            <p className="text-xs text-muted-foreground mt-1">PDF ou DOCX (máx. 100MB · até 2.000 páginas)</p>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.docx"
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <FileText className="h-8 w-8 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {ext} · {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              {!isAnalyzing && (
                <Button variant="ghost" size="icon" onClick={() => setFile(null)}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {isAnalyzing && (
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">
                  {progress < 40 ? 'Extraindo texto do documento...' : 'Analisando gramática e ortografia...'}
                </p>
              </div>
            )}

            <Button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="w-full"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Analisando...
                </>
              ) : (
                'Analisar Documento'
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
