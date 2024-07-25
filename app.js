const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const P = require('pino');
const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Função para inicializar o WhatsApp com autenticação multi-dispositivo e QR code
async function initializeWhatsApp(authDir) {
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const socket = makeWASocket({
    auth: state,
    logger: P({ level: 'silent' }),
    printQRInTerminal: true,
  });

  socket.ev.on('creds.update', saveCreds);
  return socket;
}

// Função para criar um grupo
async function createGroup(socket, groupName, participants) {
  const result = await socket.groupCreate(groupName, participants);
  return result.id;
}

// Função para adicionar participantes ao grupo
async function addParticipantsToGroup(socket, groupId, participants) {
  await socket.groupAdd(groupId, participants);
}

// Função para tornar participantes administradores
async function makeParticipantsAdmin(socket, groupId, participants) {
  await socket.groupMakeAdmin(groupId, participants);
}

// Função para definir a imagem do grupo
async function setGroupImage(socket, groupId, imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);
  await socket.updateProfilePicture(groupId, { url: imagePath });
}

// Carregar números de um arquivo
const loadNumbersFromFile = (filePath) => {
  const data = fs.readFileSync(filePath, 'utf-8');
  return data.split('\n').map(num => num.trim()).filter(num => num !== '');
};

// Lógica principal
async function main() {
  // Inicializar o número de host
  const hostSocket = await initializeWhatsApp('auth/host');
  const predefinedNumbers = loadNumbersFromFile('numbers.txt').map(num => `${num}@s.whatsapp.net`);

  // Perguntar quantos grupos criar
  rl.question('Quantos grupos você gostaria de criar? ', async (groupCount) => {
    groupCount = parseInt(groupCount);

    for (let i = 0; i < groupCount; i++) {
      const groupName = `PublicFans #${(i + 1).toString().padStart(3, '0')}`;
      const groupId = await createGroup(hostSocket, groupName, predefinedNumbers);

      console.log(`Grupo ${groupName} criado com ID: ${groupId}`);

      // Definir imagem do grupo
      const imagePath = 'group_image.jpg'; // Caminho da imagem do grupo
      await setGroupImage(hostSocket, groupId, imagePath);

      console.log(`Imagem definida para o grupo ${groupName}`);

      // Adicionar os números predefinidos como administradores
      await makeParticipantsAdmin(hostSocket, groupId, predefinedNumbers);

      console.log(`Administradores adicionados ao grupo ${groupName}`);
    }

    console.log('Grupos criados, imagens definidas e administradores adicionados!');
    rl.close();
  });
}

main().catch(err => console.error(err));
