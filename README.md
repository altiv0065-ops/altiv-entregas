# ALTIV Entregas — protótipo de conferência logística

## ALTIV Entregas 2.1 — Scanner contínuo, OCR e planilhas

Mudanças preparadas para teste Android:
- **Bipagem contínua** via `BarcodeScanner.startScan()` com lanterna, zoom, permissão de câmera e encerramento seguro da sessão. QR e código de barras vinculados à mesma BR são contados uma só vez.
- **Leitura local de etiqueta** usando câmera e ML Kit OCR Latin, com extração de rua, bairro e candidatos DOE, sem guardar imagem, texto bruto, nome ou telefone; rota precisa de confirmação do entregador.
- **Importação de AT** por lista colada, TXT, CSV ou XLSX com ExcelJS embarcado offline. O identificador isolado da AT não permite consultar os pacotes na Shopee.
- **Relatórios** de resumo por AT, BRs faltantes, extras, propostas DOE-04 → DOE-13, ruas recorrentes e solicitações de inclusão em CSV e PDF.
- A contagem de BRs da AT **não inclui pacotes extras**. Quantidade declarada, quantidade única importada e pacotes efetivamente conferidos são separados.

### Como testar no APK
1. Na aba **ATs**, importe BRs exportadas da operação. Verifique se as duplicadas são sinalizadas.
2. Na aba **Bipar**, mantenha a câmera aberta e passe vários pacotes: cada BR entra uma vez. QR opaco sem BR pede vínculo, não cria pacote fantasma.
3. Em **Fotografar etiqueta para ler rua**, confirme rua, bairro e rota sugerida manualmente antes de gravar a correção.
4. Em **Correções**, separe as BRs DOE-04 → DOE-13; gere CSV/PDF, e gere lote separado para BR física não presente na lista.
5. Verifique os resumos e PDFs com dados fictícios antes de utilizar dados reais.

**Limitações:** scanner contínuo e OCR nativo exigem teste em Android físico. Não existe integração oficial Shopee no app; somente o responsável autorizado pode mudar uma AT ou a roteirização futura. As fotos de etiquetas podem conter dados pessoais e devem ser usadas com cuidado.


## Versão 2.0 (branch `feat/altiv-entregas-v2-fluxo-leitor`)

Fluxo principal: **importar AT → bipar pacote → conferir → exportar correções**. As quatro áreas do menu são Início, ATs, Bipar e Correções. A entrada de rua e bairro é manual ou baseada em regras previamente cadastradas: **OCR automático do endereço ainda não está incluído**, e um QR não contém necessariamente rua ou bairro.

### Scanner Android e preparação inicial
- No APK Android, usar `@capacitor-mlkit/barcode-scanning` (8.x) com Code 128, Code 39, ITF e QR Code; abre a interface nativa do Google Barcode Scanner.
- O leitor nativo depende de Google Play Services. A primeira utilização pode precisar de internet para baixar o módulo de scanner; se aparecer "Preparando o leitor nativo", aguarde a instalação e tente novamente.
- A interface nativa escaneia **um código por abertura**; volte a tocar em "Abrir leitor QR / BR" para o próximo pacote. A câmera contínua do navegador só é usada onde houver `BarcodeDetector` e `getUserMedia`.
- QR contendo BR pode ser reconciliado diretamente. QR opaco exige vínculo com a BR impressa no **mesmo pacote** antes de contabilizar, para não duplicar.

### Solicitações de ajuste
- BR registrada na AT mas endereço conferido em outra DOE: registrar proposta de correção, como DOE-04 → DOE-13; exportar CSV/PDF e resumo por rua/bairro.
- BR física não presente na AT importada: bipar, registrar um **pedido de inclusão na AT** ou de criação de nova AT oficial; exportar CSV/PDF separado. O app não sabe se está em outra AT não importada.
- A mudança oficial depende dos responsáveis da operação; o aplicativo não cria ATs nem modifica registros da Shopee.

### Testes antes de uso
- Conferir lista completa de 100 BRs e contagem declarada.
- Bipar QR e barras do mesmo pacote (deve contar uma vez).
- Pacote extra e pedido de inclusão, incluindo DOE-13.
- Exportar e revisar CSV/PDF sem dados pessoais.
- Verificar o leitor nativo no modelo real de Android, especialmente após instalação do módulo.
- Não substituir o aplicativo oficial da Shopee.


Aplicativo independente para entregadores que **possuem autorização para acessar e exportar a lista de BRs de suas ATs**. Não é um aplicativo oficial da Shopee.

## Funcionalidades da Fase 1
- Importa BRs de AT por texto/CSV/TXT, conta pacotes únicos e alerta duplicidades.
- Confere QR / código de barras e impede contar a mesma BR mais de uma vez, inclusive entre ATs.
- Lista BRs ainda não bipadas, pacotes extras e divergências entre DOE-03 e DOE-04.
- Registra a proposta de mudança de rota por BR, rua (sem número) e bairro.
- Exporta relatórios CSV e PDF para apreciação do responsável pela roteirização.
- Guarda registros no dispositivo, sem servidor. Funciona offline após carregar os recursos.
- Leitura por câmera depende do suporte a `BarcodeDetector` do WebView; use entrada manual se não funcionar. Não afirmar leitura de QR genérico como se fosse BR: primeiro vincular o QR à BR.

## Como testar
1. Abra o app, importe uma AT de DOE-04 e cole uma lista de BRs às quais tem acesso autorizado.
2. Em **Bipar pacotes**, selecione a AT e leia ou digite uma BR.
3. Bipe novamente a mesma BR: a segunda tentativa deve ser marcada como duplicada, sem aumentar a contagem.
4. Registre uma correção da rota DOE-04 para DOE-03 com rua e bairro sem dados pessoais.
5. Exporte CSV/PDF no menu **Relatórios**. Confira os códigos com o responsável.

**Importante:** a correção registrada é somente uma **solicitação local**; não altera a atribuição no sistema da Shopee nem garante ajuste das próximas ATs. Um pacote não bipado significa não conferido, não necessariamente perdido. As regras por rua devem ser revisadas manualmente, pois uma mesma rua pode cruzar rotas.

## Desenvolvimento e validação
Requer Node 22+. Não precisa de chave de API nem de serviços pagos.

```bash
npm install
npm test
npm run build
```

Para visualizar no navegador: `python3 -m http.server 8080`. A primeira versão está em um único `index.html`, sem dependências externas na interface, para reduzir riscos de tela preta e facilitar o funcionamento offline.

## APK de teste pelo GitHub Actions
O workflow `.github/workflows/android-debug.yml` é executado no PR e em pushes de branches `feat/**` / `fix/**`:
1. Instala Node 22, Java 21 e Android SDK.
2. Executa testes e prepara `www/`.
3. Executa `npx cap add android`, sincroniza os recursos e compila `assembleDebug`.
4. Se a compilação passar, publica o artefato **ALTIV-Entregas-APK-debug**, contendo `ALTIV-Entregas-debug.apk`.

Abra **Actions > Build Android APK (teste) > execução > Artifacts**. Um artefato só existe depois de uma execução bem-sucedida. Não faz merge nem publica na Play Store.

## Segurança
- Não compartilhar nomes, telefones, CPFs ou endereços completos de destinatários nos relatórios.
- QR sem BR explícita exige associação manual, nunca inferência não verificada.
- Dados gravados no armazenamento local do Android/browser não são sincronizados nem criptografados nesta versão.
- Para uso multiusuário será necessário autenticação, controle de acesso e regras de isolamento por operação.
- Não acessa nem modifica APIs ou sistemas oficiais da Shopee.

## Próximos PRs
- Leitor nativo ML Kit/ZXing com testes em QR/BR reais e deduplicação pela mesma identidade.
- Reconhecimento OCR das etiquetas e sugestões de rota condicionadas à validação.
- Melhorias de backup, auditoria de aprovação e sincronização opcional autorizada.
