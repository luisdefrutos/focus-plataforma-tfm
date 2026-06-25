/**
 * Seed: CNAE_CATALOG — clasificación CNAE 2009 (INE) a nivel DIVISIÓN (2 dígitos).
 *
 * El campo `customer_master.industry_code` que llega de SAP (columna "Industry"
 * del CUSTOMER_LIST) es la división CNAE de 2 dígitos con cero a la izquierda
 * (p. ej. "01", "46", "96"). Este catálogo permite resolver code → nombre de
 * sector con un JOIN directo `industry_code = cnae_code`.
 *
 * Alcance v1: las 88 divisiones oficiales + entrada sintética "999" (Sin
 * clasificar) para el valor que SAP usa como desconocido. Los códigos de GRUPO
 * con punto ("25.1", "29.1", …) que aparecen en una minoría de clientes NO se
 * cargan aquí (gap menor conocido); su sector puede derivarse de la división
 * (los 2 primeros dígitos) en la capa de consulta.
 *
 * Fuente: clasificación oficial INE CNAE-2009 (códigos y denominaciones).
 * Idempotente (upsert por cnae_code).
 */

import { prisma, SEED_AUDIT } from './lib/prisma';
import { randomUUID } from 'node:crypto';

/** [code, nombre] de las 88 divisiones CNAE-2009. */
const DIVISIONS: Array<[string, string]> = [
  ['01', 'Agricultura, ganadería, caza y servicios relacionados con las mismas'],
  ['02', 'Silvicultura y explotación forestal'],
  ['03', 'Pesca y acuicultura'],
  ['05', 'Extracción de antracita, hulla y lignito'],
  ['06', 'Extracción de crudo de petróleo y gas natural'],
  ['07', 'Extracción de minerales metálicos'],
  ['08', 'Otras industrias extractivas'],
  ['09', 'Actividades de apoyo a las industrias extractivas'],
  ['10', 'Industria de la alimentación'],
  ['11', 'Fabricación de bebidas'],
  ['12', 'Industria del tabaco'],
  ['13', 'Industria textil'],
  ['14', 'Confección de prendas de vestir'],
  ['15', 'Industria del cuero y del calzado'],
  ['16', 'Industria de la madera y del corcho, excepto muebles; cestería y espartería'],
  ['17', 'Industria del papel'],
  ['18', 'Artes gráficas y reproducción de soportes grabados'],
  ['19', 'Coquerías y refino de petróleo'],
  ['20', 'Industria química'],
  ['21', 'Fabricación de productos farmacéuticos'],
  ['22', 'Fabricación de productos de caucho y plásticos'],
  ['23', 'Fabricación de otros productos minerales no metálicos'],
  ['24', 'Metalurgia; fabricación de productos de hierro, acero y ferroaleaciones'],
  ['25', 'Fabricación de productos metálicos, excepto maquinaria y equipo'],
  ['26', 'Fabricación de productos informáticos, electrónicos y ópticos'],
  ['27', 'Fabricación de material y equipo eléctrico'],
  ['28', 'Fabricación de maquinaria y equipo n.c.o.p.'],
  ['29', 'Fabricación de vehículos de motor, remolques y semirremolques'],
  ['30', 'Fabricación de otro material de transporte'],
  ['31', 'Fabricación de muebles'],
  ['32', 'Otras industrias manufactureras'],
  ['33', 'Reparación e instalación de maquinaria y equipo'],
  ['35', 'Suministro de energía eléctrica, gas, vapor y aire acondicionado'],
  ['36', 'Captación, depuración y distribución de agua'],
  ['37', 'Recogida y tratamiento de aguas residuales'],
  ['38', 'Recogida, tratamiento y eliminación de residuos; valorización'],
  ['39', 'Actividades de descontaminación y otros servicios de gestión de residuos'],
  ['41', 'Construcción de edificios'],
  ['42', 'Ingeniería civil'],
  ['43', 'Actividades de construcción especializada'],
  ['45', 'Venta y reparación de vehículos de motor y motocicletas'],
  ['46', 'Comercio al por mayor e intermediarios del comercio, excepto de vehículos de motor y motocicletas'],
  ['47', 'Comercio al por menor, excepto de vehículos de motor y motocicletas'],
  ['49', 'Transporte terrestre y por tubería'],
  ['50', 'Transporte marítimo y por vías navegables interiores'],
  ['51', 'Transporte aéreo'],
  ['52', 'Almacenamiento y actividades anexas al transporte'],
  ['53', 'Actividades postales y de correos'],
  ['55', 'Servicios de alojamiento'],
  ['56', 'Servicios de comidas y bebidas'],
  ['58', 'Edición'],
  ['59', 'Actividades cinematográficas, de vídeo y de programas de televisión, grabación de sonido y edición musical'],
  ['60', 'Actividades de programación y emisión de radio y televisión'],
  ['61', 'Telecomunicaciones'],
  ['62', 'Programación, consultoría y otras actividades relacionadas con la informática'],
  ['63', 'Servicios de información'],
  ['64', 'Servicios financieros, excepto seguros y fondos de pensiones'],
  ['65', 'Seguros, reaseguros y fondos de pensiones, excepto Seguridad Social obligatoria'],
  ['66', 'Actividades auxiliares a los servicios financieros y a los seguros'],
  ['68', 'Actividades inmobiliarias'],
  ['69', 'Actividades jurídicas y de contabilidad'],
  ['70', 'Actividades de las sedes centrales; actividades de consultoría de gestión empresarial'],
  ['71', 'Servicios técnicos de arquitectura e ingeniería; ensayos y análisis técnicos'],
  ['72', 'Investigación y desarrollo'],
  ['73', 'Publicidad y estudios de mercado'],
  ['74', 'Otras actividades profesionales, científicas y técnicas'],
  ['75', 'Actividades veterinarias'],
  ['77', 'Actividades de alquiler'],
  ['78', 'Actividades relacionadas con el empleo'],
  ['79', 'Actividades de agencias de viajes, operadores turísticos, servicios de reservas y actividades relacionadas con los mismos'],
  ['80', 'Actividades de seguridad e investigación'],
  ['81', 'Servicios a edificios y actividades de jardinería'],
  ['82', 'Actividades administrativas de oficina y otras actividades auxiliares a las empresas'],
  ['84', 'Administración Pública y defensa; Seguridad Social obligatoria'],
  ['85', 'Educación'],
  ['86', 'Actividades sanitarias'],
  ['87', 'Asistencia en establecimientos residenciales'],
  ['88', 'Actividades de servicios sociales sin alojamiento'],
  ['90', 'Actividades de creación, artísticas y espectáculos'],
  ['91', 'Actividades de bibliotecas, archivos, museos y otras actividades culturales'],
  ['92', 'Actividades de juegos de azar y apuestas'],
  ['93', 'Actividades deportivas, recreativas y de entretenimiento'],
  ['94', 'Actividades asociativas'],
  ['95', 'Reparación de ordenadores, efectos personales y artículos de uso doméstico'],
  ['96', 'Otros servicios personales'],
  ['97', 'Actividades de los hogares como empleadores de personal doméstico'],
  ['98', 'Actividades de los hogares como productores de bienes y servicios para uso propio'],
  ['99', 'Actividades de organizaciones y organismos extraterritoriales'],
];

/** Valor que SAP usa como "sin clasificar". */
const SPECIALS: Array<[string, string]> = [
  ['999', 'Sin clasificar / no asignado'],
];

export async function seedCnaeCatalog(): Promise<void> {
  const all = [
    ...DIVISIONS.map(([code, name]) => ({ code, name, level: 'division' })),
    ...SPECIALS.map(([code, name]) => ({ code, name, level: 'special' })),
  ];
  console.log(`🏭 Seed CNAE_CATALOG — ${all.length} entradas (${DIVISIONS.length} divisiones + ${SPECIALS.length} especiales)`);

  for (const { code, name, level } of all) {
    await prisma.cnaeCatalog.upsert({
      where: { cnaeCode: code },
      update: { cnaeName: name, cnaeLevel: level },
      create: {
        externalGuid: randomUUID(),
        cnaeCode: code,
        cnaeName: name,
        cnaeLevel: level,
        ...SEED_AUDIT,
      },
    });
  }

  const total = await prisma.cnaeCatalog.count();
  console.log(`   ✔ CNAE_CATALOG: ${total} filas en BD`);
}

if (require.main === module) {
  seedCnaeCatalog()
    .then(() => prisma.$disconnect())
    .catch(err => {
      console.error(err);
      prisma.$disconnect();
      process.exit(1);
    });
}
