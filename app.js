const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const P = require('pino');
const fs = require('fs');
const readline = require('readline');
const qrcode = require('qrcode-terminal');

// Criação da interface de leitura de dados no terminal
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
  });

  socket.ev.on('creds.update', saveCreds);
  socket.ev.on('connection.update', async (update) => {
    const { qr, connection } = update;
    if (qr) {
      console.log('QR Code recebido. Escaneie com o WhatsApp:');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'open') {
      console.log('Conectado com sucesso!');
      rl.question('Quantos grupos você gostaria de criar? ', async (groupCount) => {
        groupCount = parseInt(groupCount);
        await createGroups(socket, groupCount);
        rl.close();
      });
    }
  });

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

// Salvar o nome do grupo e o ID correspondente
const saveGroupInfo = (groupName, groupId) => {
  fs.appendFileSync('group_info.txt', `Nome: ${groupName}, ID: ${groupId}\n`);
};

// Função para criar múltiplos grupos
const createGroups = async (socket, groupCount) => {
  const predefinedNumbers = loadNumbersFromFile('numbers.txt').map(num => `${num}@s.whatsapp.net`);
  for (let i = 0; i < groupCount; i++) {
    const groupName = `PublicFans #${(i + 1).toString().padStart(3, '0')}`;
    const groupId = await createGroup(socket, groupName, predefinedNumbers);

    console.log(`Grupo ${groupName} criado com ID: ${groupId}`);

    // Definir imagem do grupo
    const imagePath = 'group_image.jpg'; // Caminho da imagem do grupo
    await setGroupImage(socket, groupId, imagePath);

    console.log(`Imagem definida para o grupo ${groupName}`);

    // Adicionar os números predefinidos como administradores
    await makeParticipantsAdmin(socket, groupId, predefinedNumbers);

    console.log(`Administradores adicionados ao grupo ${groupName}`);

    // Salvar o nome do grupo e o ID correspondente
    saveGroupInfo(groupName, groupId);
  }

  console.log('Grupos criados, imagens definidas, administradores adicionados e informações salvas!');
};

// Lógica principal
async function main() {
  await initializeWhatsApp('auth/host');
}

main().catch(err => console.error(err));
