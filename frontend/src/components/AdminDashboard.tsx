import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../components/ui/accordion';
import { Users, FileText, LogOut, Heart, Brain, Download, Trash2, Mail } from 'lucide-react';
import jsPDF from 'jspdf';
import { buildApiUrl } from '../config/api';


interface PersonalInfo {
  nombre: string;
  apellidos: string;
  edad: string;
  genero: string;
  correo: string;
  orientacionSexual: string;
}

interface Questionnaire {
  id: number;
  type: string;
  personalInfo: PersonalInfo;
  answers: Record<string, string>;
  status: string;
  userEmail?: string;
  userName?: string;
  createdAt: string;
}

interface ContactMessage {
  id: number;
  nombre: string;
  email: string;
  asunto: string;
  mensaje: string;
  status: 'unread' | 'read' | 'replied';
  createdAt: string;
  updatedAt: string;
}

interface DashboardData {
  success: boolean;
  total: number;
  pareja: {
    count: number;
    questionnaires: Questionnaire[];
  };
  personalidad: {
    count: number;
    questionnaires: Questionnaire[];
  };
}

const AdminDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [contactMessages, setContactMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('pareja');

  
  // Estados para favoritos
  const [favorites, setFavorites] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadDashboardData();
    loadContactMessages();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('adminToken');
      if (!token) {
        setError('No hay token de acceso');
        return;
      }

      const url = buildApiUrl('/api/admin/questionnaires');
      console.log('🔍 DEBUG: URL de la petición:', url);
      console.log('🔍 DEBUG: Token encontrado:', token ? 'SÍ' : 'NO');
      console.log('🔍 DEBUG: Token (primeros 20 chars):', token.substring(0, 20) + '...');

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('🔍 DEBUG: Response status:', response.status);
      console.log('🔍 DEBUG: Response ok:', response.ok);

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setDashboardData(data);
      
      // 🔍 LOGS DETALLADOS PARA DEBUGGING
      console.log('📊 Datos del dashboard cargados:', data);
      console.log('🔍 Estructura de datos:', {
        success: data.success,
        total: data.total,
        pareja_count: data.pareja?.count,
        personalidad_count: data.personalidad?.count
      });
      
      console.log('🔍 Primer cuestionario de pareja:', data.pareja?.questionnaires?.[0]);
      console.log('🔍 Primer cuestionario de personalidad:', data.personalidad?.questionnaires?.[0]);
      
      // Logs detallados de personalInfo
      if (data.pareja?.questionnaires?.[0]) {
        const firstPareja = data.pareja.questionnaires[0];
        console.log('🔍 DEBUG Primer cuestionario pareja:');
        console.log('   - ID:', firstPareja.id);
        console.log('   - Type:', firstPareja.type);
        console.log('   - personalInfo:', firstPareja.personalInfo);
        console.log('   - personalInfo.nombre:', firstPareja.personalInfo?.nombre);
        console.log('   - personalInfo.apellidos:', firstPareja.personalInfo?.apellidos);
        console.log('   - personalInfo.edad:', firstPareja.personalInfo?.edad);
        console.log('   - personalInfo.correo:', firstPareja.personalInfo?.correo);
        console.log('   - answers:', firstPareja.answers);
        console.log('   - answers keys:', Object.keys(firstPareja.answers || {}));
      }
      } catch (err) {
        // console.error('❌ Error cargando dashboard:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const loadContactMessages = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) return;

      const response = await fetch(buildApiUrl('/api/admin/contact-messages'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setContactMessages(data.data.messages || []);
      }
    } catch (error) {
      console.error('Error cargando mensajes de contacto:', error);
    }
  };

  const handleUpdateMessageStatus = async (messageId: number, status: 'read' | 'replied') => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) return;

      const response = await fetch(buildApiUrl(`/api/admin/contact-messages/${messageId}/status`), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });

      if (response.ok) {
        // Actualizar el estado local
        setContactMessages(prev => 
          prev.map(msg => 
            msg.id === messageId ? { ...msg, status } : msg
          )
        );
      }
    } catch (error) {
      console.error('Error actualizando status del mensaje:', error);
    }
  };

  const handleDeleteMessage = async (messageId: number) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este mensaje?')) return;

    try {
      const token = localStorage.getItem('adminToken');
      if (!token) return;

      const response = await fetch(buildApiUrl(`/api/admin/contact-messages/${messageId}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Remover el mensaje del estado local
        setContactMessages(prev => prev.filter(msg => msg.id !== messageId));
      }
    } catch (error) {
      console.error('Error eliminando mensaje:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    window.location.hash = '#/admin-login';
  };



  // Función para descargar cuestionario como PDF
  const downloadQuestionnaire = (questionnaire: Questionnaire) => {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const maxWidth = pageWidth - (margin * 2);
    let yPosition = margin;

    // Función auxiliar para agregar texto con salto de línea automático
    const addText = (text: string, fontSize: number = 12, isBold: boolean = false) => {
      pdf.setFontSize(fontSize);
      if (isBold) {
        pdf.setFont('helvetica', 'bold');
      } else {
        pdf.setFont('helvetica', 'normal');
      }
      
      const lines = pdf.splitTextToSize(text, maxWidth);
      
      // Verificar si necesitamos una nueva página
      if (yPosition + (lines.length * (fontSize * 0.5)) > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
      }
      
      pdf.text(lines, margin, yPosition);
      yPosition += lines.length * (fontSize * 0.5) + 5;
      return yPosition;
    };

    // Título principal
    pdf.setFillColor(52, 152, 219); // Azul
    pdf.rect(0, 0, pageWidth, 40, 'F');
    pdf.setTextColor(255, 255, 255);
    addText(`CUESTIONARIO DE ${questionnaire.type.toUpperCase()}`, 20, true);
    yPosition = 50;
    pdf.setTextColor(0, 0, 0);

    // Información personal
    addText('INFORMACIÓN PERSONAL', 16, true);
    yPosition += 5;
    
    addText(`Nombre Completo: ${questionnaire.personalInfo?.nombre || 'Usuario'} ${questionnaire.personalInfo?.apellidos || 'Desconocido'}`, 12);
    addText(`Edad: ${questionnaire.personalInfo?.edad || 'N/A'} años`, 12);
    addText(`Género: ${questionnaire.personalInfo?.genero || 'N/A'}`, 12);
    addText(`Orientación Sexual: ${questionnaire.personalInfo?.orientacionSexual || 'N/A'}`, 12);
    addText(`Correo Electrónico: ${questionnaire.personalInfo?.correo || 'N/A'}`, 12);
    addText(`Fecha de Completado: ${formatDate(questionnaire.createdAt)}`, 12);
    
    yPosition += 10;
    
    // Línea separadora
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 15;

    // Título de respuestas
    addText('RESPUESTAS DEL CUESTIONARIO', 16, true);
    yPosition += 5;

    // Obtener las preguntas correctas según el tipo
    const questions = questionnaire.type === 'personalidad' ? personalityQuestions : coupleQuestions;

    // Respuestas
    Object.entries(questionnaire.answers).forEach(([questionIndex, answerData]) => {
      // Usar la función auxiliar para procesar los datos
      const { question, answer } = processAnswerDataForPDF(answerData, questionIndex, questionnaire.type);

      // DEBUG: Log para identificar respuestas problemáticas
              // console.log(`🔍 PDF - Pregunta ${questionIndex}:`, { question, answer, rawData: answerData });

      // Agregar pregunta
      addText(`${parseInt(questionIndex) + 1}. ${question}`, 11, true);
      
      // Agregar respuesta con formato especial - FORMATO UNIFORME GARANTIZADO
      // RESET COMPLETO de colores antes de cada respuesta
      pdf.setFillColor(240, 248, 255); // Azul muy claro
      pdf.setTextColor(60, 60, 60); // Gris oscuro
      
      const answerLines = pdf.splitTextToSize(`Respuesta: ${answer}`, maxWidth - 10);
      
      // Verificar si necesitamos una nueva página para la respuesta
      if (yPosition + (answerLines.length * 6) + 10 > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
        // RE-ESTABLECER colores en nueva página
        pdf.setFillColor(240, 248, 255);
        pdf.setTextColor(60, 60, 60);
      }
      
      // Dibujar rectángulo de fondo
      pdf.rect(margin, yPosition - 3, maxWidth, (answerLines.length * 6) + 6, 'F');
      
      // Escribir texto de respuesta
      pdf.text(answerLines, margin + 5, yPosition + 3);
      
      // RESTAURAR colores para preguntas
      pdf.setFillColor(255, 255, 255); // Blanco
      pdf.setTextColor(0, 0, 0); // Negro
      yPosition += (answerLines.length * 6) + 10;
    });

    // Pie de página en la última página
    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(128, 128, 128);
      pdf.text(`Página ${i} de ${totalPages}`, pageWidth - margin - 30, pageHeight - 10);
      pdf.text('Sistema de Cuestionarios - Salud Mental', margin, pageHeight - 10);
    }

    // Guardar el PDF
    const fileName = `cuestionario_${questionnaire.type}_${questionnaire.personalInfo?.nombre || 'Usuario'}_${questionnaire.personalInfo?.apellidos || 'Desconocido'}_${questionnaire.id}.pdf`;
    pdf.save(fileName);
  };

  // Función para borrar cuestionario
  const deleteQuestionnaire = async (questionnaireId: number) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este cuestionario? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        alert('No hay token de acceso');
        return;
      }

      const response = await fetch(buildApiUrl(`/api/admin/questionnaires/${questionnaireId}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      // Actualizar el estado local eliminando el cuestionario
      if (dashboardData) {
        const updatedData = { ...dashboardData };
        updatedData.pareja.questionnaires = updatedData.pareja.questionnaires.filter(q => q.id !== questionnaireId);
        updatedData.personalidad.questionnaires = updatedData.personalidad.questionnaires.filter(q => q.id !== questionnaireId);
        updatedData.pareja.count = updatedData.pareja.questionnaires.length;
        updatedData.personalidad.count = updatedData.personalidad.questionnaires.length;
        updatedData.total = updatedData.pareja.count + updatedData.personalidad.count;
        setDashboardData(updatedData);
      }

      alert('Cuestionario eliminado exitosamente');
          } catch (err) {
        // console.error('❌ Error eliminando cuestionario:', err);
      alert(`Error al eliminar el cuestionario: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    }
  };





  // Función para agregar/quitar favoritos
  const toggleFavorite = (questionnaireId: number) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(questionnaireId)) {
        newFavorites.delete(questionnaireId);
      } else {
        newFavorites.add(questionnaireId);
      }
      return newFavorites;
    });
  };



  const formatDate = (dateString: string) => {
    if (!dateString || dateString === '') {
      return 'Fecha no disponible';
    }
    
    try {
      const date = new Date(dateString);
      
      // Verificar si la fecha es válida
      if (isNaN(date.getTime())) {
        return 'Fecha inválida';
      }
      
      // Verificar si es la fecha epoch (1970)
      if (date.getFullYear() === 1970) {
        return 'Fecha no disponible';
      }
      
      return date.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Error en fecha';
    }
  };

  // Función auxiliar para procesar respuestas correctamente
  const processAnswerData = (answerData: any, questionIndex: string, questionnaireType: string) => {
    let question = '';
    let answer = '';
    
    // Extraer pregunta
    const questionIndexNum = parseInt(questionIndex);
    if (questionnaireType === 'personalidad' && questionIndexNum < personalityQuestions.length) {
      question = personalityQuestions[questionIndexNum];
    } else if (questionnaireType === 'pareja' && questionIndexNum < coupleQuestions.length) {
      question = coupleQuestions[questionIndexNum];
    } else {
      question = `Pregunta ${questionIndexNum + 1}`;
    }

    // Extraer respuesta
    if (answerData === null || answerData === undefined) {
      answer = 'Sin respuesta';
    } else if (typeof answerData === 'string') {
      answer = answerData;
    } else if (typeof answerData === 'object') {
      // Manejar estructura anidada: answerData.answer.answer
      if (answerData.answer && typeof answerData.answer === 'object' && answerData.answer.answer) {
        answer = String(answerData.answer.answer);
      } else if (answerData.answer) {
        answer = String(answerData.answer);
      } else if (answerData.value) {
        answer = String(answerData.value);
      } else if (answerData.response) {
        answer = String(answerData.response);
      } else if (answerData.text) {
        answer = String(answerData.text);
      } else {
        // Tomar el primer valor que no sea nulo
        const values = Object.values(answerData);
        const firstValidValue = values.find(v => v !== null && v !== undefined);
        if (firstValidValue) {
          answer = String(firstValidValue);
        } else {
          answer = JSON.stringify(answerData);
        }
      }
    } else {
      answer = String(answerData);
    }

    return { question, answer };
  };

  // Función auxiliar para procesar respuestas correctamente (solo para PDF)
  const processAnswerDataForPDF = (answerData: any, questionIndex: string, questionnaireType: string) => {
    let question = '';
    let answer = '';
    
    // Extraer pregunta
    const questionIndexNum = parseInt(questionIndex);
    if (questionnaireType === 'personalidad' && questionIndexNum < personalityQuestions.length) {
      question = personalityQuestions[questionIndexNum];
    } else if (questionnaireType === 'pareja' && questionIndexNum < coupleQuestions.length) {
      question = coupleQuestions[questionIndexNum];
    } else {
      question = `Pregunta ${questionIndexNum + 1}`;
    }

    // Extraer respuesta
    if (answerData === null || answerData === undefined) {
      answer = 'Sin respuesta';
    } else if (typeof answerData === 'string') {
      answer = answerData;
    } else if (typeof answerData === 'object') {
      // Manejar estructura anidada: answerData.answer.answer
      if (answerData.answer && typeof answerData.answer === 'object' && answerData.answer.answer) {
        answer = String(answerData.answer.answer);
      } else if (answerData.answer) {
        answer = String(answerData.answer);
      } else if (answerData.value) {
        answer = String(answerData.value);
      } else if (answerData.response) {
        answer = String(answerData.response);
      } else if (answerData.text) {
        answer = String(answerData.text);
      } else {
        // Tomar el primer valor que no sea nulo
        const values = Object.values(answerData);
        const firstValidValue = values.find(v => v !== null && v !== undefined);
        if (firstValidValue) {
          answer = String(firstValidValue);
        } else {
          answer = JSON.stringify(answerData);
        }
      }
    } else {
      answer = String(answerData);
    }

    return { question, answer };
  };

  // Definir las preguntas del cuestionario de personalidad
  const personalityQuestions = [
    "¿Conectas fácilmente con gente nueva?",
    "¿Te resulta fácil establecer conversación con un desconocido?",
    "¿Te sientes más cómodo estando solo que en grupo?",
    "¿Socializar puede agotar tu energía rápidamente?",
    "¿Prefieres las llamadas telefónicas a los mensajes de texto cuando te comunicas con otras personas?",
    "¿En situaciones sociales prefieres quedarte con caras conocidas antes que conocer a otras nuevas?",
    "¿Prefieres las actividades en solitario a las interacciones en grupo?",
    "¿Debatir y analizar obras creativas te apasiona?",
    "¿Te gustan las películas con conclusiones abiertas que permitan la interpretación?",
    "¿Siempre te han intrigado los misterios de la vida después de la muerte?",
    "¿Te encanta debatir conceptos teóricos y puedes pasarte horas conversando sobre ellos?",
    "¿A menudo reflexionas sobre el significado de las cosas en lugar de aceptarlas sin más?",
    "¿Te atraen las nuevas experiencias y te gusta explorar lugares desconocidos?",
    "¿Te gusta mantener conversaciones profundas que inviten a la reflexión?",
    "¿Reflexionar sobre experiencias pasadas te ayuda a comprender tus creencias y valores actuales?",
    "¿Disfrutas aprendiendo nuevas ideas y conceptos, buscando constantemente el conocimiento?",
    "¿Te gustan los debates animados en los que puedes compartir e intercambiar ideas con los demás?",
    "¿La curiosidad te impulsa a explorar nuevas ideas y temas en profundidad?",
    "¿Puedes pasarte horas profundizando en los temas que despiertan tu curiosidad?",
    "¿Eres paciente con las personas que no son tan rápidas o eficientes como tú?",
    "¿Cuándo alguien a tu alrededor está disgustado tiendes a sentir también sus emociones?",
    "¿Te cuesta empatizar con personas de orígenes muy diferentes?",
    "¿Cuándo alguien piensa de forma diferente a ti, intentas comprender de verdad a la otra parte?",
    "¿Valoras la honestidad por encima del tacto, aunque sea duro?",
    "¿Empatizas con los sentimientos de los demás, aunque no hayas compartido sus experiencias?",
    "¿Alcanzar metas personales te produce más satisfacción que ayudar a los demás?",
    "¿A veces te cuesta entender las emociones de los demás?",
    "¿Sueles hacer planes de emergencia?",
    "¿Mantienes la compostura incluso bajo presión?",
    "¿Los entornos dinámicos y de ritmo rápido te dan energía y te desenvuelves bien bajo presión?",
    "¿Te gustan los retos, especialmente en entornos de alta presión?",
    "¿En situaciones sociales prefieres quedarte con caras conocidas antes que conocer a otras nuevas?",
    "¿Un pequeño error a veces puede hacer dudar de tus conocimientos generales sobre un tema?",
    "¿Conocer gente nueva te hace preocuparte por la impresión que has causado?",
    "¿Con frecuencia te preocupa el peor escenario posible en cualquier situación?",
    "¿A menudo consideras las decisiones que has tomado?",
    "¿La inseguridad es algo con lo que lidias a menudo?",
    "¿Los errores de tu pasado suelen perdurar en la memoria?",
    "¿A menudo te preocupan incertidumbres futuras, incluso en situaciones tranquilas?",
    "¿Eres una persona que aprecia los recuerdos y los objetos sentimentales?",
    "¿Crees que el mundo mejoraría si la gente tomara decisiones más basadas en las emociones?",
    "¿Te molesta que los demás discutan delante de ti?",
    "¿Te gusta organizar tu día con listas y horarios?",
    "¿Prefieres seguir una rutina a ser espontáneo?",
    "¿Te sientes más a gusto cuando tu entorno está ordenado y organizado?",
    "¿A menudo sigues tus sentimientos más que tu lógica?",
    "¿Cuándo tienes que elegir sigues a tu corazón y eliges lo que te parece correcto?",
    "¿Te identificas mucho con ser una persona artística?",
    "¿Te gusta pasar tiempo en museos de arte?",
    "¿Te gusta mantener conversaciones profundas que inviten a la reflexión?",
    "¿La curiosidad te impulsa a explorar nuevas ideas y temas en profundidad?",
    "¿Te gusta ser el centro de atención?",
    "¿Prefieres una rutina diaria bien estructurada y te sientes más cómodo cuando las cosas son predecibles?",
    "¿Prefieres relajarte antes de ocuparte de las tareas domésticas?",
    "¿Prefieres tomar decisiones rápidamente en lugar de pensar en ellas?",
    "¿Confías más en tu instinto que en horarios o planes escritos?",
    "¿Te adaptas fácilmente a los cambios inesperados de planes?",
    "¿A la hora de tomar decisiones, priorizas la lógica y la objetividad sobre las emociones?",
    "¿Tomas las riendas de forma natural en situaciones de grupo guiando a los demás hacia objetivos comunes?",
    "¿Te gusta asumir funciones de liderazgo?",
    "¿Tiendes a ser autocrítico, a reflexionar constantemente sobre tus acciones y a esforzarte por mejorar?",
    "¿Para ti es importante tener objetivos claros y trabajar diligentemente para alcanzarlos?",
    "¿Pasar tiempo a solas es algo que aprecias y encuentras paz en las actividades solitarias?",
    "¿Eres tu mejor amigo?",
    "¿Cómo te gusta pasar tu tiempo libre? (Hobbies)",
    "¿Tienes alguna alergia, fobia o algo que deberíamos tener en cuenta para la cita?"
  ];

  // Definir las preguntas del cuestionario de pareja
  const coupleQuestions = [
    "¿Qué buscas principalmente en una relación?",
    "¿Cómo prefieres pasar tiempo con tu pareja?",
    "¿Qué valoras más en una persona?",
    "¿Cómo manejas los conflictos en una relación?",
    "¿Qué te gustaría mejorar en ti mismo para una relación?",
    "¿Qué tan importante es la comunicación en una relación para ti?",
    "¿Cómo te sientes cuando tu pareja necesita espacio personal?",
    "¿Qué tan importante es la confianza en una relación?",
    "¿Cómo reaccionas cuando tu pareja tiene éxito?",
    "¿Qué tan importante es la compatibilidad sexual?",
    "¿Cómo manejas los celos en una relación?",
    "¿Qué tan importante es compartir valores en una relación?",
    "¿Cómo te sientes cuando tu pareja tiene amigos del sexo opuesto?",
    "¿Qué tan importante es la independencia financiera en una relación?",
    "¿Cómo manejas las diferencias de opinión con tu pareja?",
    "¿Qué tan importante es la compatibilidad de horarios y estilo de vida?",
    "¿Cómo te gustaría que sea tu relación ideal?"
  ];

  const renderQuestionnaireCard = (questionnaire: Questionnaire) => (
    <Card key={questionnaire.id} className={`mb-6 shadow-lg ${favorites.has(questionnaire.id) ? 'border-2 border-yellow-300' : ''}`}>
      <CardHeader className="pb-4 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl font-bold text-gray-800">
                {questionnaire.personalInfo?.nombre || 'Usuario'} {questionnaire.personalInfo?.apellidos || 'Desconocido'}
              </CardTitle>
              {favorites.has(questionnaire.id) && (
                <span className="text-yellow-500 text-xl">⭐</span>
              )}
            </div>
            <div className="flex gap-2 mt-3">
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200">
                {questionnaire.personalInfo?.edad || 'N/A'} años
              </Badge>
              <Badge variant="outline" className="border-gray-300 text-gray-700">
                {questionnaire.personalInfo?.genero || 'N/A'}
              </Badge>
              <Badge variant="outline" className="border-purple-300 text-purple-700">
                {questionnaire.personalInfo?.orientacionSexual || 'N/A'}
              </Badge>
            </div>
          </div>
          <div className="text-right text-sm text-gray-600 flex flex-col items-end gap-2">
                            <div className="font-medium">✅ Completado: {formatDate(questionnaire.createdAt)}</div>
            <div className="flex gap-2">
              {/* Botón de favorito solo para cuestionarios de pareja */}
              {activeTab === 'pareja' && (
                <Button
                  onClick={() => toggleFavorite(questionnaire.id)}
                  size="sm"
                  variant="ghost"
                  className={`hover:bg-yellow-50 ${favorites.has(questionnaire.id) ? 'text-yellow-600' : 'text-gray-400'}`}
                  title="Marcar como favorito"
                >
                  ⭐
                </Button>
              )}
              
              {/* Botón de descargar */}
              <Button
                onClick={() => downloadQuestionnaire(questionnaire)}
                size="sm"
                variant="outline"
                className="hover:bg-green-50 hover:border-green-300 hover:text-green-600"
                title="Descargar cuestionario"
              >
                <Download className="h-4 w-4" />
              </Button>
              
              {/* Botón de borrar */}
              <Button
                onClick={() => deleteQuestionnaire(questionnaire.id)}
                size="sm"
                variant="outline"
                className="hover:bg-red-50 hover:border-red-300 hover:text-red-600"
                title="Eliminar cuestionario"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-6">
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <strong className="text-sm text-gray-700">📧 Email:</strong>
          <span className="ml-2 text-blue-600 font-medium">{questionnaire.personalInfo?.correo || 'N/A'}</span>
          {questionnaire.userEmail && questionnaire.userEmail !== questionnaire.personalInfo.correo && (
            <div className="mt-2">
              <strong className="text-sm text-gray-700">👤 Usuario registrado:</strong>
              <span className="ml-2 text-green-600 font-medium">{questionnaire.userEmail}</span>
            </div>
          )}
        </div>
        
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="answers" className="border-2 border-gray-200 rounded-lg">
            <AccordionTrigger className="text-base font-semibold text-gray-800 hover:text-blue-600 px-4 py-3">
              📋 Ver respuestas ({Object.keys(questionnaire.answers).length} preguntas)
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {Object.entries(questionnaire.answers).map(([questionIndex, answerData]) => {


                  // Procesamiento directo y más agresivo
                  let question = '';
                  let answer = '';

                  // Extraer pregunta
                  const questionIndexNum = parseInt(questionIndex);
                  if (questionnaire.type === 'personalidad' && questionIndexNum < personalityQuestions.length) {
                    question = personalityQuestions[questionIndexNum];
                  } else if (questionnaire.type === 'pareja' && questionIndexNum < coupleQuestions.length) {
                    question = coupleQuestions[questionIndexNum];
                  } else {
                    question = `Pregunta ${questionIndexNum + 1}`;
                  }

                  // Extraer respuesta de manera muy agresiva
                  if (answerData === null || answerData === undefined) {
                    answer = 'Sin respuesta';
                  } else if (typeof answerData === 'string') {
                    answer = answerData;
                  } else if (typeof answerData === 'object') {
                    // Intentar múltiples propiedades en orden
                    const data = answerData as any;
                    if (data.answer) {
                      answer = String(data.answer);
                    } else if (data.value) {
                      answer = String(data.value);
                    } else if (data.response) {
                      answer = String(data.response);
                    } else if (data.text) {
                      answer = String(data.text);
                    } else {
                      // Tomar el primer valor que no sea nulo
                      const values = Object.values(data);
                      const firstValidValue = values.find(v => v !== null && v !== undefined);
                      if (firstValidValue) {
                        answer = String(firstValidValue);
                      } else {
                        answer = JSON.stringify(data);
                      }
                    }
                  } else {
                    answer = String(answerData);
                  }


                  
                  return (
                    <div key={questionIndex} className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">
                          {parseInt(questionIndex) + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-gray-800 mb-2">
                            {question}
                          </div>
                          <div className="text-gray-700 bg-gray-50 p-3 rounded border-l-4 border-blue-400">
                            <strong>Respuesta:</strong> {(() => {
                              // 🔍 DEBUG: Log para ver qué viene
                              console.log(`🔍 Respuesta para pregunta ${questionIndex}:`, answerData);
                              
                              // ✅ Ahora que el backend está corregido, las respuestas vienen directamente como strings
                              if (typeof answerData === 'string') {
                                return answerData;
                              }
                              
                              // Fallback para casos especiales
                              if (answerData && typeof answerData === 'object') {
                                // Si es un objeto, buscar la propiedad más probable
                                const data = answerData as any;
                                const result = data.answer || data.value || data.response || data.text;
                                return typeof result === 'string' ? result : 'Respuesta no válida';
                              }
                              
                              // Convertir a string si es otro tipo
                              return answerData ? String(answerData) : 'Sin respuesta';
                            })()}
                          </div>

                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );



  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando panel de administración...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-500 mb-4">
            <FileText className="h-16 w-16 mx-auto" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Error al cargar el dashboard</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <div className="space-x-2">
            <Button onClick={loadDashboardData} variant="outline">
              Reintentar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">No hay datos disponibles</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">Panel de Administración</h1>
                <p className="text-muted-foreground">Gestión de cuestionarios completados</p>
              </div>
            </div>
            <div className="flex gap-2">
                              <Button
                  onClick={() => window.location.hash = '#/compatibility-analysis'}
                  variant="default"
                  size="sm"
                  className="bg-pink-500 hover:bg-pink-600"
                >
                  <Heart className="h-4 w-4 mr-2" />
                  Análisis de Compatibilidad
                </Button>
                <Button
                  onClick={() => window.location.hash = '#/personality-compatibility-analysis'}
                  variant="default"
                  size="sm"
                  className="bg-blue-500 hover:bg-blue-600"
                >
                  <Brain className="h-4 w-4 mr-2" />
                  Análisis de Personalidad
                </Button>

              <Button onClick={handleLogout} variant="destructive" size="sm">
                <LogOut className="h-4 w-4 mr-2" />
                Cerrar Sesión
              </Button>
            </div>
          </div>
        </div>
      </div>

              {/* Stats Cards */}
        <div className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Cuestionarios</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData.total}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cuestionarios de Pareja</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData.pareja.count}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cuestionarios de Personalidad</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData.personalidad.count}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Mensajes de Contacto</CardTitle>
                <Mail className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{contactMessages.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {contactMessages.filter(m => m.status === 'unread').length} sin leer
                </p>
              </CardContent>
            </Card>
          </div>



        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pareja" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Pareja ({dashboardData.pareja.count})
            </TabsTrigger>
            <TabsTrigger value="personalidad" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Personalidad ({dashboardData.personalidad.count})
              {dashboardData.personalidad.count === 0 && (
                <span className="ml-1 text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">
                  Vacío
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="contacto" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Contacto ({contactMessages.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pareja" className="space-y-4">
            {dashboardData.pareja.count === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No hay cuestionarios de pareja completados aún.
                </CardContent>
              </Card>
            ) : (
              dashboardData.pareja.questionnaires.map(renderQuestionnaireCard)
            )}
          </TabsContent>

          <TabsContent value="personalidad" className="space-y-4">
            {dashboardData.personalidad.count === 0 ? (
              <Card className="border-2 border-dashed border-gray-300">
                <CardContent className="pt-12 pb-12 text-center">
                  <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <FileText className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">
                    No hay cuestionarios de personalidad
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Aún no se han completado cuestionarios de personalidad.
                  </p>
                  <div className="text-sm text-gray-400">
                    Los usuarios pueden acceder al cuestionario desde la página principal
                  </div>
                </CardContent>
              </Card>
            ) : (
              dashboardData.personalidad.questionnaires.map(renderQuestionnaireCard)
            )}
          </TabsContent>

          <TabsContent value="contacto" className="space-y-4">
            {contactMessages.length === 0 ? (
              <Card className="border-2 border-dashed border-gray-300">
                <CardContent className="pt-12 pb-12 text-center">
                  <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <Mail className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">
                    No hay mensajes de contacto
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Aún no se han recibido mensajes de contacto.
                  </p>
                  <div className="text-sm text-gray-400">
                    Los usuarios pueden enviar mensajes desde el formulario de contacto
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {contactMessages.map((message) => (
                  <Card key={message.id} className="border-l-4 border-l-blue-500">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <Mail className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{message.nombre}</CardTitle>
                            <p className="text-sm text-gray-600">{message.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={message.status === 'unread' ? 'default' : message.status === 'read' ? 'secondary' : 'outline'}
                            className={message.status === 'unread' ? 'bg-red-100 text-red-800' : ''}
                          >
                            {message.status === 'unread' ? 'Nuevo' : message.status === 'read' ? 'Leído' : 'Respondido'}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {new Date(message.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {message.asunto && (
                          <div>
                            <h4 className="font-medium text-gray-900">Asunto:</h4>
                            <p className="text-gray-700">{message.asunto}</p>
                          </div>
                        )}
                        <div>
                          <h4 className="font-medium text-gray-900">Mensaje:</h4>
                          <p className="text-gray-700 whitespace-pre-wrap">{message.mensaje}</p>
                        </div>
                        <div className="flex items-center gap-2 pt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUpdateMessageStatus(message.id, 'read')}
                            disabled={message.status === 'read'}
                          >
                            Marcar como leído
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUpdateMessageStatus(message.id, 'replied')}
                            disabled={message.status === 'replied'}
                          >
                            Marcar como respondido
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteMessage(message.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>


    </div>
  );
};

export default AdminDashboard;
