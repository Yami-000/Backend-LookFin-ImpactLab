import models from '../models/index.js';
import validationSchemas from '../validations/index.js';
import {
    addMensajeToFirestore,
    updateMensajeFromFirestore,
    getMensajeFromFirestore,
    getMensajesByChatFromFirestore,
    getMensajesByUsuarioFromFirestore,
    deleteMensajeFromFirestore,
    deleteMensajesByChatFromFirestore
} from '../config/firestoreMensajes.js';
import {
    createUserWithEmailPassword,
    verifyIdToken,
    getUserByUID,
    deleteUserByUID
} from '../config/firebaseAuth.js';
import admin from '../config/firebaseAdmin.js';

const { Chat, Mensaje, Usuario } = models;
const { chatValidationSchema, mensajeValidationSchema, usuarioValidationSchema, updateUsuarioValidationSchema } = validationSchemas;

const extractStoragePathFromUrl = (url) => {
    if (!url || typeof url !== 'string') return null;
    if (!url.includes('/o/')) return null;
    try {
        const [, afterO] = url.split('/o/');
        const encodedPath = afterO.split('?')[0];
        if (!encodedPath) return null;
        return decodeURIComponent(encodedPath);
    } catch {
        return null;
    }
};

const deleteStorageObjectIfExists = async (mediaURL) => {
    const storagePath = extractStoragePathFromUrl(mediaURL);
    if (!storagePath) return;
    try {
        await admin.storage().bucket().file(storagePath).delete({ ignoreNotFound: true });
    } catch (error) {
        console.warn('No se pudo eliminar archivo de Storage asociado al mensaje:', error?.message || error);
    }
};

const enrichMensajeWithUser = async (mensaje) => {
    if (!mensaje) return null;
    const usuario = await Usuario.findByPk(mensaje.usuarioID);
    return {
        ...mensaje,
        usuario
    };
};

const resolvers = {
    Query: {
        // ------------------------------ Usuario ------------------------------
        getUsuarios: async () => {
            try {
                return await Usuario.findAll();
            } catch (error) {
                console.error('query getUsuarios - Error al obtener los usuarios:', error);
                throw new Error('query getUsuarios - Error al obtener los usuarios');
            }
        },

        getUsuarioByID: async (_, { id }) => {
            try {
                const usuario = await Usuario.findByPk(id);
                if (!usuario) {
                    throw new Error('query getUsuarioByID - Usuario no encontrado');
                }
                return usuario;
            } catch (error) {
                console.error('query getUsuarioByID - Error al obtener el usuario:', error);
                throw new Error('query getUsuarioByID - Error al obtener el usuario');
            }
        },

        // ------------------------------ Chat ------------------------------
        getChats: async () => {
            try {
                return await Chat.findAll({
                    include: [{ model: Usuario, as: 'usuario' }]
                });
            } catch (error) {
                console.error('query getChats - Error al obtener los chats:', error);
                throw new Error('query getChats - Error al obtener los chats');
            }
        },

        getChatByID: async (_, { id }) => {
            try {
                const chat = await Chat.findByPk(id, {
                    include: [{ model: Usuario, as: 'usuario' }]
                });
                if (!chat) {
                    throw new Error('query getChatByID - Chat no encontrado');
                }
                return chat;
            } catch (error) {
                console.error('query getChatByID - Error al obtener el chat:', error);
                throw new Error('query getChatByID - Error al obtener el chat');
            }
        },

        getChatsByUsuarioID: async (_, { usuarioID }) => {
            try {
                return await Chat.findAll({
                    where: { usuarioID },
                    include: [{ model: Usuario, as: 'usuario' }]
                });
            } catch (error) {
                console.error('query getChatsByUsuarioID - Error al obtener los chats del usuario:', error);
                throw new Error('query getChatsByUsuarioID - Error al obtener los chats del usuario');
            }
        },

        // ------------------------------ Mensaje ------------------------------
        getMensajes: async (_, { usuarioID }) => {
            try {
                const mensajes = await getMensajesByUsuarioFromFirestore(usuarioID);
                return await Promise.all(mensajes.map((mensaje) => enrichMensajeWithUser(mensaje)));
            } catch (error) {
                console.error('query getMensajes - Error al obtener los mensajes:', error);
                throw new Error('query getMensajes - Error al obtener los mensajes');
            }
        },

        getMensajeByID: async (_, { id, usuarioID }) => {
            try {
                const mensaje = await getMensajeFromFirestore(id);
                if (!mensaje) {
                    throw new Error('query getMensajeByID - Mensaje no encontrado');
                }
                
                // Verificar que el usuario sea propietario del chat
                const chat = await Chat.findByPk(mensaje.chatID);
                if (!chat || chat.usuarioID !== usuarioID) {
                    throw new Error('No autorizado: no tienes acceso a este mensaje');
                }
                
                return await enrichMensajeWithUser(mensaje);
            } catch (error) {
                console.error('query getMensajeByID - Error al obtener el mensaje:', error);
                throw new Error('query getMensajeByID - Error al obtener el mensaje');
            }
        },

        getMensajesByChatID: async (_, { chatID, usuarioID }) => {
            try {
                // Verificar que el usuario sea propietario del chat
                const chat = await Chat.findByPk(chatID);
                if (!chat || chat.usuarioID !== usuarioID) {
                    throw new Error('No autorizado: no tienes acceso a este chat');
                }

                const mensajes = await getMensajesByChatFromFirestore(chatID);
                return await Promise.all(mensajes.map((mensaje) => enrichMensajeWithUser(mensaje)));
            } catch (error) {
                console.error('query getMensajesByChatID - Error al obtener los mensajes del chat:', error);
                throw new Error('query getMensajesByChatID - Error al obtener los mensajes del chat');
            }
        },
    },

    Mutation: {
        // ------------------------------ Usuario ------------------------------
        addUsuario: async (_, { input }) => {
            const { value, error } = usuarioValidationSchema.validate(input, { abortEarly: false, stripUnknown: true });
            if (error) {
                throw new Error(`Mutation addUsuario - Error de validación: ${error.details.map(err => err.message).join(', ')}`);
            }
            try {
                // Crear usuario en Firebase
                const firebaseUser = await createUserWithEmailPassword(value.correoElectronico, value.contrasena);
                
                // Crear usuario en PostgreSQL
                const usuario = await Usuario.create({
                    ...value,
                    firebaseUID: firebaseUser.uid
                });
                
                return usuario;
            } catch (error) {
                console.error('Mutation addUsuario - Error al agregar usuario:', error);
                throw new Error('Mutation addUsuario - Error al agregar usuario: ' + error.message);
            }
        },

        updUsuario: async (_, { id, input }) => {
            const { value, error } = updateUsuarioValidationSchema.validate(input, { abortEarly: false, stripUnknown: true });
            if (error) {
                throw new Error(`Mutation updUsuario - Error de validación: ${error.details.map(err => err.message).join(', ')}`);
            }
            try {
                const usuario = await Usuario.findByPk(id);
                if (!usuario) {
                    throw new Error('Mutation updUsuario - Usuario no encontrado');
                }
                await usuario.update(value);
                return usuario;
            } catch (error) {
                console.error('Mutation updUsuario - Error al actualizar el usuario:', error);
                throw new Error('Mutation updUsuario - Error al actualizar el usuario: ' + error.message);
            }
        },

        delUsuario: async (_, { id }) => {
            try {
                const usuario = await Usuario.findByPk(id);
                if (!usuario) {
                    throw new Error('Mutation delUsuario - Usuario no encontrado');
                }
                
                // Eliminar usuario de Firebase
                if (usuario.firebaseUID) {
                    await deleteUserByUID(usuario.firebaseUID);
                }
                
                // Eliminar chats asociados
                const chats = await Chat.findAll({ where: { usuarioID: id } });
                for (const chat of chats) {
                    await deleteMensajesByChatFromFirestore(chat.id);
                    await chat.destroy();
                }
                
                // Eliminar usuario de PostgreSQL
                await usuario.destroy();
                return { message: 'Usuario eliminado exitosamente' };
            } catch (error) {
                console.error('Mutation delUsuario - Error al eliminar el usuario:', error);
                throw new Error('Mutation delUsuario - Error al eliminar el usuario: ' + error.message);
            }
        },

        // ------------------------------ Chat ------------------------------
        addChat: async (_, { input }) => {
            const { value, error } = chatValidationSchema.validate(input, { abortEarly: false, stripUnknown: true });
            if (error) {
                throw new Error(`Mutation addChat - Error de validación: ${error.details.map(err => err.message).join(', ')}`);
            }
            try {
                const chat = await Chat.create(value);
                return await Chat.findByPk(chat.id, {
                    include: [{ model: Usuario, as: 'usuario' }]
                });
            } catch (error) {
                console.error('Mutation addChat - Error al agregar chat:', error);
                throw new Error('Mutation addChat - Error al agregar chat: ' + error.message);
            }
        },

        updChat: async (_, { id, input }) => {
            const { value, error } = chatValidationSchema.validate(input, { abortEarly: false, stripUnknown: true });
            if (error) {
                throw new Error(`Mutation updChat - Error de validación: ${error.details.map(err => err.message).join(', ')}`);
            }
            try {
                const chat = await Chat.findByPk(id);
                if (!chat) {
                    throw new Error('Mutation updChat - Chat no encontrado');
                }
                await chat.update(value);
                return await Chat.findByPk(id, {
                    include: [{ model: Usuario, as: 'usuario' }]
                });
            } catch (error) {
                console.error('Mutation updChat - Error al actualizar el chat:', error);
                throw new Error('Mutation updChat - Error al actualizar el chat: ' + error.message);
            }
        },

        delChat: async (_, { id }) => {
            try {
                const chat = await Chat.findByPk(id);
                if (!chat) {
                    throw new Error('Mutation delChat - Chat no encontrado');
                }
                
                // Eliminar todos los mensajes del chat
                await deleteMensajesByChatFromFirestore(id);
                
                // Eliminar el chat
                await chat.destroy();
                return { message: 'Chat eliminado exitosamente' };
            } catch (error) {
                console.error('Mutation delChat - Error al eliminar el chat:', error);
                throw new Error('Mutation delChat - Error al eliminar el chat: ' + error.message);
            }
        },

        // ------------------------------ Mensaje ------------------------------
        addMensaje: async (_, { input }) => {
            const { value, error } = mensajeValidationSchema.validate(input, { abortEarly: false, stripUnknown: true });
            if (error) {
                throw new Error(`Mutation addMensaje - Error de validación: ${error.details.map(err => err.message).join(', ')}`);
            }
            try {
                // Verificar que el chat existe y el usuario tiene acceso
                const chat = await Chat.findByPk(value.chatID);
                if (!chat || chat.usuarioID !== value.usuarioID) {
                    throw new Error('No autorizado: no tienes acceso a este chat');
                }

                const mensaje = await addMensajeToFirestore(value);
                return await enrichMensajeWithUser(mensaje);
            } catch (error) {
                console.error('Mutation addMensaje - Error al agregar mensaje:', error);
                throw new Error('Mutation addMensaje - Error al agregar mensaje: ' + error.message);
            }
        },

        updMensaje: async (_, { id, input }) => {
            const { value, error } = mensajeValidationSchema.validate(input, { abortEarly: false, stripUnknown: true });
            if (error) {
                throw new Error(`Mutation updMensaje - Error de validación: ${error.details.map(err => err.message).join(', ')}`);
            }
            try {
                const mensajeActual = await getMensajeFromFirestore(id);
                if (!mensajeActual) {
                    throw new Error('Mutation updMensaje - Mensaje no encontrado');
                }

                // Verificar que el usuario sea el dueño del mensaje
                if (mensajeActual.usuarioID !== value.usuarioID) {
                    throw new Error('No autorizado: solo el usuario que envió el mensaje puede editarlo');
                }

                const mensaje = await updateMensajeFromFirestore(id, value);
                if (!mensaje) {
                    throw new Error('Mutation updMensaje - Mensaje no encontrado');
                }
                return await enrichMensajeWithUser(mensaje);
            } catch (error) {
                console.error('Mutation updMensaje - Error al actualizar el mensaje:', error);
                throw new Error('Mutation updMensaje - Error al actualizar el mensaje: ' + error.message);
            }
        },

        delMensaje: async (_, { id, usuarioID }) => {
            try {
                const mensaje = await getMensajeFromFirestore(id);
                if (!mensaje) {
                    throw new Error('Mutation delMensaje - Mensaje no encontrado');
                }

                // Verificar que el usuario sea el dueño del mensaje
                if (mensaje.usuarioID !== usuarioID) {
                    throw new Error('No autorizado: solo el usuario que envió el mensaje puede eliminarlo');
                }

                if (mensaje.archivoAdjuntoURL) {
                    await deleteStorageObjectIfExists(mensaje.archivoAdjuntoURL);
                }

                await deleteMensajeFromFirestore(id);
                return { message: 'Mensaje eliminado exitosamente' };
            } catch (error) {
                console.error('Mutation delMensaje - Error al eliminar el mensaje:', error);
                throw new Error('Mutation delMensaje - Error al eliminar el mensaje: ' + error.message);
            }
        },

        // ------------------------------ Auth Firebase (Sign Up / Login) ------------------------------
        signUpEmailPassword: async (_, { input }) => {
            const { value, error } = validationSchemas.signUpEmailPasswordValidationSchema.validate(input, { abortEarly: false, stripUnknown: true });
            if (error) {
                throw new Error(`Mutation signUpEmailPassword - Error de validación: ${error.details.map(err => err.message).join(', ')}`);
            }
            try {
                // Crear usuario en Firebase
                const firebaseUser = await createUserWithEmailPassword(value.correoElectronico, value.contrasena);
                
                // Crear usuario en PostgreSQL
                const usuario = await Usuario.create({
                    nombre: value.nombre,
                    correoElectronico: value.correoElectronico,
                    contrasena: value.contrasena,
                    firebaseUID: firebaseUser.uid
                });

                return {
                    success: true,
                    message: 'Usuario registrado exitosamente',
                    usuario,
                    firebaseUID: firebaseUser.uid
                };
            } catch (error) {
                console.error('Mutation signUpEmailPassword - Error al registrar usuario:', error);
                throw new Error('Mutation signUpEmailPassword - Error al registrar usuario: ' + error.message);
            }
        },

        loginEmailPassword: async (_, { input }) => {
            const { value, error } = validationSchemas.loginEmailPasswordValidationSchema.validate(input, { abortEarly: false, stripUnknown: true });
            if (error) {
                throw new Error(`Mutation loginEmailPassword - Error de validación: ${error.details.map(err => err.message).join(', ')}`);
            }
            try {
                // Verificar el token de Firebase
                const decodedToken = await verifyIdToken(value.idToken);
                
                // Obtener usuario de PostgreSQL
                const usuario = await Usuario.findOne({
                    where: { firebaseUID: decodedToken.uid }
                });

                if (!usuario) {
                    throw new Error('Mutation loginEmailPassword - Usuario no encontrado');
                }

                return {
                    success: true,
                    message: 'Login exitoso',
                    usuario,
                    firebaseUID: decodedToken.uid,
                    idToken: value.idToken
                };
            } catch (error) {
                console.error('Mutation loginEmailPassword - Error al iniciar sesión:', error);
                throw new Error('Mutation loginEmailPassword - Error al iniciar sesión: ' + error.message);
            }
        },

        logout: async (_, { input }) => {
            const { value, error } = validationSchemas.logoutValidationSchema.validate(input, { abortEarly: false, stripUnknown: true });
            if (error) {
                throw new Error(`Mutation logout - Error de validación: ${error.details.map(err => err.message).join(', ')}`);
            }
            try {
                // Verificar que el token es válido antes de desloguear
                await verifyIdToken(value.idToken);

                return {
                    success: true,
                    message: 'Logout exitoso'
                };
            } catch (error) {
                console.error('Mutation logout - Error al cerrar sesión:', error);
                throw new Error('Mutation logout - Error al cerrar sesión: ' + error.message);
            }
        }
    }
};

export default resolvers;
