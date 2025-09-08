/**
 * Configuración del estado de pago en el backend
 * CAMBIAR isPaid a true cuando el cliente pague
 */

const paymentConfig = {
  isPaid: true, // PAGADO - Acceso habilitado
  amount: 25000,
  dueDate: '2024-01-31',
  projectName: 'Love on the Brain',
  developer: 'José Juan Pérez González',
  email: 'joseperezglz01@gmail.com',
  linkedin: 'https://www.linkedin.com/in/jose-juan-perez-gonzalez/',
  github: 'https://github.com/josewalke',
  // Información adicional para el sistema de bloqueo
  lastUpdated: new Date().toISOString(),
  version: '1.0.0'
};

module.exports = paymentConfig;
