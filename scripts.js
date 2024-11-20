const translations = {
    en: {
        about: "About",
        services: "Services",
        skills: "My Skills",
        work: "My Work",
        contact: "Contact Me",
        "intro-hello": "Hello, My name is",
        "intro-description": "I'm a Graphic designer & Frontend developer.",
        "download-cv": "Download CV",
        "lets-talk": "Let's Talk",
        "about-title": "About Me",
        "about-description": "Passionate about graphic design and frontend development, I combine creativity and technical skills to create impactful visual experiences...",
        "services-title": "My Services",
        "service1-title": "Creative graphic design",
        "service1-description": "Visual identity design, UI/UX interface, illustrations...",
        "service2-title": "Interactive frontend development",
        "service2-description": "HTML, CSS, JavaScript, CMS integration...",
        "service3-title": "User experience (UX) design",
        "service3-description": "Wireframing, prototyping, user testing...",
        "service4-title": "Maintenance and support",
        "service4-description": "Website monitoring, bug fixing, 24/7 support...",
        "work-title": "My Work",
        project1: "Project 1",
        project2: "Project 2",
        project3: "Project 3",
        project4: "Project 4",
        "contact-title": "Contact Me",
    },
    es: {
        about: "Acerca de",
        services: "Servicios",
        skills: "Mis Habilidades",
        work: "Mi Trabajo",
        contact: "Contáctame",
        "intro-hello": "Hola, mi nombre es",
        "intro-description": "Soy diseñador gráfico y desarrollador Frontend.",
        "download-cv": "Descargar CV",
        "lets-talk": "Hablemos",
        "about-title": "Sobre mí",
        "about-description": "Apasionado por el diseño gráfico y el desarrollo frontend, combino creatividad y habilidades técnicas para crear experiencias visuales impactantes...",
        "services-title": "Mis Servicios",
        "service1-title": "Diseño gráfico creativo",
        "service1-description": "Diseño de identidad visual, interfaces UI/UX, ilustraciones...",
        "service2-title": "Desarrollo Frontend interactivo",
        "service2-description": "HTML, CSS, JavaScript, integración CMS...",
        "service3-title": "Diseño de experiencia de usuario (UX)",
        "service3-description": "Wireframing, prototipos, pruebas de usuario...",
        "service4-title": "Mantenimiento y soporte",
        "service4-description": "Monitoreo web, corrección de errores, soporte 24/7...",
        "work-title": "Mi Trabajo",
        project1: "Proyecto 1",
        project2: "Proyecto 2",
        project3: "Proyecto 3",
        project4: "Proyecto 4",
        "contact-title": "Contáctame",
    },
};

const languageToggle = document.getElementById("language-toggle");
let currentLanguage = "en";

languageToggle.addEventListener("click", () => {
    currentLanguage = currentLanguage === "en" ? "es" : "en";
    languageToggle.textContent = currentLanguage === "en" ? "ES" : "EN";
    translatePage(currentLanguage);
});

function translatePage(language) {
    const elements = document.querySelectorAll("[data-lang]");
    elements.forEach((element) => {
        const key = element.getAttribute("data-lang");
        element.textContent = translations[language][key];
    });
}
