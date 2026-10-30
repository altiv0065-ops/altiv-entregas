import {readFile,writeFile} from 'node:fs/promises';
const path='android/app/src/main/AndroidManifest.xml';
let xml=await readFile(path,'utf8');
if(!xml.includes('android.permission.CAMERA'))xml=xml.replace('<application', '<uses-permission android:name="android.permission.CAMERA" />\n    <uses-feature android:name="android.hardware.camera" android:required="false" />\n    <application');
if(!xml.includes('com.google.mlkit.vision.DEPENDENCIES'))xml=xml.replace(/<application([^>]*)>/, '<application$1>\n        <meta-data android:name="com.google.mlkit.vision.DEPENDENCIES" android:value="barcode_ui" />');
if(!xml.includes('android.permission.CAMERA'))throw Error('Camera permission not configured');
await writeFile(path,xml);
console.log('Android camera permission configured');
