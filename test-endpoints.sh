#!/bin/bash

echo "🧪 Probando endpoints del backend..."

echo "1. Health check:"
curl -s http://localhost:10000/health
echo -e "\n"

echo "2. Contact endpoint:"
curl -X POST http://localhost:10000/api/contact \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Test User",
    "email": "test@example.com",
    "asunto": "Prueba de contacto",
    "mensaje": "Este es un mensaje de prueba para verificar que el endpoint funciona correctamente."
  }'
echo -e "\n"

echo "3. Questionnaire sync endpoint:"
curl -X POST http://localhost:10000/api/questionnaires/sync \
  -H "Content-Type: application/json" \
  -d '{
    "type": "pareja",
    "personalInfo": {
      "nombre": "Test",
      "apellidos": "User",
      "edad": "25",
      "genero": "femenino",
      "correo": "test@example.com",
      "orientacionSexual": "heterosexual"
    },
    "answers": {
      "0": "Respuesta 1",
      "1": "Respuesta 2"
    },
    "completed": true,
    "timestamp": 1693564800000
  }'
echo -e "\n"

echo "✅ Pruebas completadas"
