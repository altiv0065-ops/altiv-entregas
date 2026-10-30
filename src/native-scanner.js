// Capacitor 8 / Android: scanner continuo no WebView transparente e OCR local.
// Nunca salvar QR bruto ou texto completo de etiquetas.
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { Torch } from '@capawesome/capacitor-torch';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { TextRecognition, Script } from '@capacitor-mlkit/text-recognition';
import { parseLabelText } from './ocr-parser.mjs';

if (Capacitor.isNativePlatform()) {
  let listener = null;
  let active = false;
  let torch = false;
  let lastCode = '';
  let lastTime = 0;
  let busy = false;
  const formats = [BarcodeFormat.QrCode, BarcodeFormat.Code128, BarcodeFormat.Code39, BarcodeFormat.Itf];
  async function stop() {
    active = false;
    if (listener) { await listener.remove(); listener = null; }
    if (torch) { await Torch.disable().catch(() => {}); torch = false; }
    await BarcodeScanner.stopScan().catch(() => {});
    busy = false;
  }
  window.ALTIVNativeScanner = {
    async start(onCode) {
      if (active) return;
      const supported = await BarcodeScanner.isSupported();
      if (!supported.supported) throw new Error('Leitor ML Kit indisponivel.');
      let permission = await BarcodeScanner.checkPermissions();
      if (permission.camera !== 'granted') permission = await BarcodeScanner.requestPermissions();
      if (permission.camera !== 'granted') throw new Error('Permita o acesso a camera nas configuracoes do Android.');
      active = true;
      try {
        listener = await BarcodeScanner.addListener('barcodeScanned', async ({ barcode }) => {
          const raw = String(barcode?.rawValue ?? '').trim();
          const now = Date.now();
          if (!raw || !active || busy || (raw === lastCode && now - lastTime < 4500)) return;
          lastCode = raw; lastTime = now; busy = true;
          try { await onCode(raw); } finally { busy = false; }
        });
        await BarcodeScanner.startScan({ formats });
      } catch (err) { await stop(); throw err; }
    },
    stop,
    async toggleTorch() {
      if (!active) throw new Error('Abra o leitor antes de ligar a lanterna.');
      const available = await Torch.isAvailable();
      if (!available.available) throw new Error('Lanterna indisponivel neste aparelho.');
      if (torch) await Torch.disable(); else await Torch.enable();
      torch = !torch;
      return torch;
    },
    async zoom() {
      if (!active) throw new Error('Abra o leitor primeiro.');
      const { zoomRatio: current } = await BarcodeScanner.getZoomRatio();
      const { zoomRatio: max } = await BarcodeScanner.getMaxZoomRatio();
      const next = current < Math.min(2, max) ? Math.min(2, max) : 1;
      await BarcodeScanner.setZoomRatio({ zoomRatio: next });
      return next;
    },
    get active() { return active; }
  };
  window.ALTIVNativeOCR = {
    async readLabel() {
      // Camera fotografica nao grava na galeria. OCR retorna somente rua/bairro/rotas.
      const image = await Camera.getPhoto({
        source: CameraSource.Camera,
        resultType: CameraResultType.Uri,
        quality: 85,
        saveToGallery: false,
        correctOrientation: true
      });
      if (!image.path) throw new Error('Nao foi possivel acessar a foto local. Tente novamente.');
      const result = await TextRecognition.processImage({path: image.path,script: Script.Latin});
      return parseLabelText(result.text || '');
    }
  };
}
