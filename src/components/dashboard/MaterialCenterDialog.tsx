'use client';

import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Layers } from 'lucide-react';

interface MaterialCenterDialogProps {
  tabType: 'personal' | 'team';
  buttonText?: string;
}

export function MaterialCenterDialog({ tabType, buttonText = '打开素材中心窗口' }: MaterialCenterDialogProps) {
  const [open, setOpen] = useState(false);
  const src = useMemo(() => `/material/history?type=${tabType}`, [tabType]);

  return (
    <>
      <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}>
        <Layers className="h-4 w-4" />
        {buttonText}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-6xl h-[85vh]">
          <DialogHeader>
            <DialogTitle>素材中心</DialogTitle>
          </DialogHeader>
          <div className="h-full w-full rounded border overflow-hidden">
            <iframe src={src} className="w-full h-full" title="素材中心窗口" />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
