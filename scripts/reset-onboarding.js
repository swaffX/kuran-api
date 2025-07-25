const { exec } = require('child_process');

console.log('Onboarding durumunu sıfırlama işlemi başlatılıyor...');

// AsyncStorage'daki onboarding değerini sıfırlayan komut
const command = `
npx react-native start --reset-cache & 
echo "import AsyncStorage from '@react-native-async-storage/async-storage'; AsyncStorage.removeItem('onboarding_completed').then(() => console.log('Onboarding sıfırlandı!')).catch(err => console.error('Hata:', err));" > resetOnboarding.js && 
npx react-native run-android --no-packager
`;

// Komutu çalıştır
exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error(`Hata oluştu: ${error.message}`);
    return;
  }
  if (stderr) {
    console.error(`Stderr: ${stderr}`);
    return;
  }
  console.log(`Çıktı: ${stdout}`);
  console.log('Onboarding durumu başarıyla sıfırlandı. Uygulamayı yeniden başlatın.');
}); 