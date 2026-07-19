import { PrismaClient, type Prisma } from "@prisma/client";

/**
 * Seeds ~100 real, widely-recognized football managers active in the top-5
 * European leagues across the 2012-2024 window (matching the real player
 * dataset's era). Names/nationalities are real facts. The tactical profile
 * per manager (mentality/tempo/width/pressing/passingStyle/managerPhilosophy)
 * is OUR OWN classification, hand-curated from well-documented, widely
 * reported public tactical analysis — not copied from any proprietary rating
 * system (no FIFA/FM-style manager attributes involved). See RefManager's
 * schema comment in schema.prisma for the same disclosure.
 *
 * Small enough (100 rows) to hand-author directly rather than run through an
 * ETL pipeline like the real player/club dataset (see tools/data-etl/).
 */

const prisma = new PrismaClient();

type Mentality = "very-defensive" | "defensive" | "balanced" | "attacking" | "very-attacking";
type Tempo = "slow" | "balanced" | "fast";
type Width = "narrow" | "balanced" | "wide";
type Pressing = "low" | "medium" | "high";
type PassingStyle = "short" | "mixed" | "direct";
type ManagerPhilosophy = "possession" | "counter-attack" | "gegenpress" | "direct-play" | "park-the-bus";

interface ManagerSeed {
  name: string;
  nationality: string;
  philosophy: string;
  mentality: Mentality;
  tempo: Tempo;
  width: Width;
  pressing: Pressing;
  passingStyle: PassingStyle;
  managerPhilosophy?: ManagerPhilosophy;
}

const MANAGERS: ManagerSeed[] = [
  { name: "Pep Guardiola", nationality: "Spain", philosophy: "Positional possession play with relentless pressing to win the ball back instantly.", mentality: "very-attacking", tempo: "fast", width: "wide", pressing: "high", passingStyle: "short", managerPhilosophy: "possession" },
  { name: "Jürgen Klopp", nationality: "Germany", philosophy: "Gegenpressing — win the ball back within seconds and counter at full throttle.", mentality: "attacking", tempo: "fast", width: "wide", pressing: "high", passingStyle: "mixed", managerPhilosophy: "gegenpress" },
  { name: "Carlo Ancelotti", nationality: "Italy", philosophy: "Calm, adaptable man-management with tactics built around the players he has.", mentality: "balanced", tempo: "balanced", width: "balanced", pressing: "medium", passingStyle: "mixed" },
  { name: "José Mourinho", nationality: "Portugal", philosophy: "Defensive solidity first, ruthless on the counter, wins ugly if he has to.", mentality: "defensive", tempo: "slow", width: "narrow", pressing: "medium", passingStyle: "direct", managerPhilosophy: "counter-attack" },
  { name: "Diego Simeone", nationality: "Argentina", philosophy: "Cholismo — a compact low block and relentless work-rate from every player.", mentality: "very-defensive", tempo: "slow", width: "narrow", pressing: "high", passingStyle: "direct", managerPhilosophy: "counter-attack" },
  { name: "Antonio Conte", nationality: "Italy", philosophy: "Intense, disciplined pressing out of a back three, direct transitions.", mentality: "defensive", tempo: "fast", width: "narrow", pressing: "high", passingStyle: "direct", managerPhilosophy: "counter-attack" },
  { name: "Thomas Tuchel", nationality: "Germany", philosophy: "Structured, high-intensity pressing with flexible back-three systems.", mentality: "attacking", tempo: "fast", width: "balanced", pressing: "high", passingStyle: "mixed", managerPhilosophy: "gegenpress" },
  { name: "Zinedine Zidane", nationality: "France", philosophy: "Trusts elite individual quality within a simple, balanced structure.", mentality: "balanced", tempo: "balanced", width: "balanced", pressing: "medium", passingStyle: "mixed" },
  { name: "Massimiliano Allegri", nationality: "Italy", philosophy: "Pragmatic and defensively disciplined, wins by controlling the game's tempo.", mentality: "defensive", tempo: "slow", width: "narrow", pressing: "medium", passingStyle: "direct", managerPhilosophy: "park-the-bus" },
  { name: "Mikel Arteta", nationality: "Spain", philosophy: "Guardiola-schooled possession with intense coordinated pressing triggers.", mentality: "attacking", tempo: "balanced", width: "wide", pressing: "high", passingStyle: "short", managerPhilosophy: "possession" },
  { name: "Xabi Alonso", nationality: "Spain", philosophy: "Possession-based build-up combined with aggressive, high-line pressing.", mentality: "attacking", tempo: "fast", width: "wide", pressing: "high", passingStyle: "short", managerPhilosophy: "gegenpress" },
  { name: "Xavi Hernández", nationality: "Spain", philosophy: "Positional play built around quick, short combinations through midfield.", mentality: "attacking", tempo: "balanced", width: "wide", pressing: "medium", passingStyle: "short", managerPhilosophy: "possession" },
  { name: "Luis Enrique", nationality: "Spain", philosophy: "Fluid, attacking possession football with fast wide overloads.", mentality: "very-attacking", tempo: "fast", width: "wide", pressing: "high", passingStyle: "short", managerPhilosophy: "possession" },
  { name: "Unai Emery", nationality: "Spain", philosophy: "Meticulous tactical planning, adapts structure week to week for control.", mentality: "balanced", tempo: "balanced", width: "balanced", pressing: "medium", passingStyle: "mixed" },
  { name: "Julian Nagelsmann", nationality: "Germany", philosophy: "Flexible high-line pressing with constantly rotating positional structures.", mentality: "attacking", tempo: "fast", width: "wide", pressing: "high", passingStyle: "mixed", managerPhilosophy: "gegenpress" },
  { name: "Hansi Flick", nationality: "Germany", philosophy: "Vertical, high-tempo attacking football with aggressive pressing.", mentality: "very-attacking", tempo: "fast", width: "wide", pressing: "high", passingStyle: "short", managerPhilosophy: "gegenpress" },
  { name: "Ralf Rangnick", nationality: "Germany", philosophy: "The godfather of gegenpressing — win it high, attack in seconds.", mentality: "attacking", tempo: "fast", width: "wide", pressing: "high", passingStyle: "direct", managerPhilosophy: "gegenpress" },
  { name: "Erik ten Hag", nationality: "Netherlands", philosophy: "Ajax-style possession building with an aggressive, high defensive line.", mentality: "attacking", tempo: "fast", width: "wide", pressing: "high", passingStyle: "short", managerPhilosophy: "possession" },
  { name: "Ronald Koeman", nationality: "Netherlands", philosophy: "Classic Dutch possession football, patient build-up through the thirds.", mentality: "balanced", tempo: "balanced", width: "wide", pressing: "medium", passingStyle: "short", managerPhilosophy: "possession" },
  { name: "Marcelo Bielsa", nationality: "Argentina", philosophy: "Man-marking, relentless pressing everywhere on the pitch, no matter the risk.", mentality: "very-attacking", tempo: "fast", width: "wide", pressing: "high", passingStyle: "direct", managerPhilosophy: "gegenpress" },
  { name: "Mauricio Pochettino", nationality: "Argentina", philosophy: "High-energy pressing with a young, fit squad running teams into the ground.", mentality: "attacking", tempo: "fast", width: "wide", pressing: "high", passingStyle: "mixed", managerPhilosophy: "gegenpress" },
  { name: "Simone Inzaghi", nationality: "Italy", philosophy: "Compact defensive shape that springs quickly into direct counters.", mentality: "attacking", tempo: "balanced", width: "wide", pressing: "medium", passingStyle: "mixed", managerPhilosophy: "counter-attack" },
  { name: "Stefano Pioli", nationality: "Italy", philosophy: "Balanced 4-2-3-1 built on defensive organisation and quick transitions.", mentality: "balanced", tempo: "balanced", width: "balanced", pressing: "medium", passingStyle: "mixed" },
  { name: "Luciano Spalletti", nationality: "Italy", philosophy: "Inverted wingers and fluid rotations feeding a possession-heavy attack.", mentality: "attacking", tempo: "balanced", width: "wide", pressing: "medium", passingStyle: "short", managerPhilosophy: "possession" },
  { name: "Gian Piero Gasperini", nationality: "Italy", philosophy: "Man-oriented marking and relentless vertical attacking with a back three.", mentality: "very-attacking", tempo: "fast", width: "wide", pressing: "high", passingStyle: "direct", managerPhilosophy: "gegenpress" },
  { name: "Thiago Motta", nationality: "Italy", philosophy: "Positional, possession-heavy football with a back three that builds from deep.", mentality: "attacking", tempo: "fast", width: "wide", pressing: "high", passingStyle: "short", managerPhilosophy: "possession" },
  { name: "Vincenzo Italiano", nationality: "Italy", philosophy: "High-pressing, possession-based attacking football with constant movement.", mentality: "attacking", tempo: "fast", width: "wide", pressing: "high", passingStyle: "short", managerPhilosophy: "possession" },
  { name: "Roberto De Zerbi", nationality: "Italy", philosophy: "Deliberately invites pressure to play through it, then floods forward.", mentality: "attacking", tempo: "balanced", width: "wide", pressing: "high", passingStyle: "short", managerPhilosophy: "possession" },
  { name: "Claudio Ranieri", nationality: "Italy", philosophy: "Old-school pragmatism — organised defence first, direct counters at pace.", mentality: "defensive", tempo: "balanced", width: "narrow", pressing: "medium", passingStyle: "mixed", managerPhilosophy: "counter-attack" },
  { name: "Walter Mazzarri", nationality: "Italy", philosophy: "Conservative, well-drilled defensive block with quick vertical outlets.", mentality: "defensive", tempo: "balanced", width: "narrow", pressing: "medium", passingStyle: "direct", managerPhilosophy: "park-the-bus" },
  { name: "Ivan Jurić", nationality: "Croatia", philosophy: "Aggressive man-marking press with a back three and direct wing play.", mentality: "defensive", tempo: "fast", width: "narrow", pressing: "high", passingStyle: "direct", managerPhilosophy: "counter-attack" },
  { name: "Niko Kovač", nationality: "Croatia", philosophy: "Disciplined, balanced structure that leans on set pieces and transitions.", mentality: "balanced", tempo: "balanced", width: "balanced", pressing: "medium", passingStyle: "mixed" },
  { name: "Igor Tudor", nationality: "Croatia", philosophy: "High-intensity, high-line football with aggressive full-backs.", mentality: "very-attacking", tempo: "fast", width: "wide", pressing: "high", passingStyle: "direct", managerPhilosophy: "gegenpress" },
  { name: "Christophe Galtier", nationality: "France", philosophy: "Compact, well-organised defensive shape that breaks quickly on the counter.", mentality: "defensive", tempo: "balanced", width: "narrow", pressing: "medium", passingStyle: "mixed", managerPhilosophy: "counter-attack" },
  { name: "Laurent Blanc", nationality: "France", philosophy: "Composed possession from the back, patient circulation through midfield.", mentality: "balanced", tempo: "balanced", width: "wide", pressing: "medium", passingStyle: "short", managerPhilosophy: "possession" },
  { name: "Rudi Garcia", nationality: "France", philosophy: "Attacking 4-3-3 built around wide creativity and quick combinations.", mentality: "attacking", tempo: "balanced", width: "wide", pressing: "medium", passingStyle: "mixed" },
  { name: "Franck Haise", nationality: "France", philosophy: "Well-drilled defensive block that punishes mistakes on the break.", mentality: "defensive", tempo: "balanced", width: "balanced", pressing: "medium", passingStyle: "direct", managerPhilosophy: "counter-attack" },
  { name: "Will Still", nationality: "Belgium", philosophy: "Modern, high-pressing possession football from a young, energetic squad.", mentality: "attacking", tempo: "fast", width: "wide", pressing: "high", passingStyle: "mixed", managerPhilosophy: "gegenpress" },
  { name: "Vincent Kompany", nationality: "Belgium", philosophy: "Guardiola-influenced build-up play insisted on even under pressure.", mentality: "attacking", tempo: "balanced", width: "wide", pressing: "high", passingStyle: "short", managerPhilosophy: "possession" },
  { name: "Roberto Martínez", nationality: "Spain", philosophy: "Patient possession-based football with a back three and inverted full-backs.", mentality: "attacking", tempo: "balanced", width: "wide", pressing: "medium", passingStyle: "short", managerPhilosophy: "possession" },
  { name: "Rúben Amorim", nationality: "Portugal", philosophy: "Rigid 3-4-3 structure with quick vertical transitions and wing-backs.", mentality: "balanced", tempo: "balanced", width: "wide", pressing: "medium", passingStyle: "mixed" },
  { name: "Sérgio Conceição", nationality: "Portugal", philosophy: "Direct, fast-transition football with intense pressing triggers.", mentality: "balanced", tempo: "fast", width: "wide", pressing: "medium", passingStyle: "direct", managerPhilosophy: "counter-attack" },
  { name: "Nuno Espírito Santo", nationality: "Portugal", philosophy: "Compact, disciplined shape that absorbs pressure and counters directly.", mentality: "defensive", tempo: "slow", width: "narrow", pressing: "medium", passingStyle: "direct", managerPhilosophy: "counter-attack" },
  { name: "Paulo Fonseca", nationality: "Portugal", philosophy: "Possession-oriented football with fluid front-three interchange.", mentality: "attacking", tempo: "balanced", width: "wide", pressing: "medium", passingStyle: "mixed", managerPhilosophy: "possession" },
  { name: "Marco Silva", nationality: "Portugal", philosophy: "Energetic pressing with quick transitions from a well-organised base.", mentality: "balanced", tempo: "fast", width: "wide", pressing: "high", passingStyle: "mixed" },
  { name: "Vítor Pereira", nationality: "Portugal", philosophy: "Pragmatic, well-organised setup adapted to match the opponent.", mentality: "balanced", tempo: "balanced", width: "balanced", pressing: "medium", passingStyle: "mixed" },
  { name: "José Bordalás", nationality: "Spain", philosophy: "Intense physical pressing and a deliberately combative defensive line.", mentality: "very-defensive", tempo: "slow", width: "narrow", pressing: "high", passingStyle: "direct", managerPhilosophy: "park-the-bus" },
  { name: "Marcelino García Toral", nationality: "Spain", philosophy: "Defensively compact 4-4-2 that squeezes space and counters with pace.", mentality: "defensive", tempo: "balanced", width: "narrow", pressing: "medium", passingStyle: "direct", managerPhilosophy: "counter-attack" },
  { name: "Julen Lopetegui", nationality: "Spain", philosophy: "Structured possession-based football built from patient build-up play.", mentality: "balanced", tempo: "balanced", width: "wide", pressing: "medium", passingStyle: "short", managerPhilosophy: "possession" },
  { name: "Quique Setién", nationality: "Spain", philosophy: "Extreme possession-based football, patient circulation even deep in own half.", mentality: "attacking", tempo: "slow", width: "wide", pressing: "medium", passingStyle: "short", managerPhilosophy: "possession" },
  { name: "Ernesto Valverde", nationality: "Spain", philosophy: "Cautious, balanced setup that leans on individual quality to break teams down.", mentality: "balanced", tempo: "balanced", width: "balanced", pressing: "medium", passingStyle: "mixed" },
  { name: "Imanol Alguacil", nationality: "Spain", philosophy: "Possession-based football with intense pressing from a compact midfield.", mentality: "balanced", tempo: "balanced", width: "wide", pressing: "medium", passingStyle: "short", managerPhilosophy: "possession" },
  { name: "Míchel Sánchez", nationality: "Spain", philosophy: "High-tempo, possession-heavy football with an aggressive attacking line.", mentality: "attacking", tempo: "fast", width: "wide", pressing: "high", passingStyle: "short", managerPhilosophy: "possession" },
  { name: "Diego Martínez", nationality: "Spain", philosophy: "Well-organised, disciplined defensive block with quick vertical outlets.", mentality: "defensive", tempo: "balanced", width: "narrow", pressing: "medium", passingStyle: "direct", managerPhilosophy: "counter-attack" },
  { name: "Íñigo Pérez", nationality: "Spain", philosophy: "Energetic pressing with fluid positional rotations in midfield.", mentality: "balanced", tempo: "balanced", width: "wide", pressing: "medium", passingStyle: "mixed" },
  { name: "Manuel Pellegrini", nationality: "Chile", philosophy: "Calm, possession-based attacking football with minimal defensive fuss.", mentality: "attacking", tempo: "balanced", width: "wide", pressing: "medium", passingStyle: "short", managerPhilosophy: "possession" },
  { name: "Arsène Wenger", nationality: "France", philosophy: "Fluid, technical possession football built on patient passing triangles.", mentality: "attacking", tempo: "balanced", width: "wide", pressing: "medium", passingStyle: "short", managerPhilosophy: "possession" },
  { name: "Alex Ferguson", nationality: "Scotland", philosophy: "Relentless attacking mentality and late-game momentum built on squad depth.", mentality: "attacking", tempo: "fast", width: "wide", pressing: "medium", passingStyle: "mixed" },
  { name: "Brendan Rodgers", nationality: "Northern Ireland", philosophy: "Possession-based football that looks to dominate territory and the ball.", mentality: "attacking", tempo: "balanced", width: "wide", pressing: "medium", passingStyle: "short", managerPhilosophy: "possession" },
  { name: "Steven Gerrard", nationality: "England", philosophy: "Aggressive, front-footed pressing with a direct attacking mentality.", mentality: "attacking", tempo: "fast", width: "wide", pressing: "medium", passingStyle: "mixed" },
  { name: "Frank Lampard", nationality: "England", philosophy: "Attack-minded setup that trusts individual quality to create chances.", mentality: "attacking", tempo: "balanced", width: "balanced", pressing: "medium", passingStyle: "mixed" },
  { name: "Eddie Howe", nationality: "England", philosophy: "High-energy pressing with quick, direct transitions into the final third.", mentality: "attacking", tempo: "fast", width: "wide", pressing: "high", passingStyle: "mixed", managerPhilosophy: "gegenpress" },
  { name: "Graham Potter", nationality: "England", philosophy: "Flexible, possession-based football with constantly shifting shapes.", mentality: "balanced", tempo: "balanced", width: "wide", pressing: "medium", passingStyle: "short", managerPhilosophy: "possession" },
  { name: "Sean Dyche", nationality: "England", philosophy: "Physical, direct football built on set-piece threat and defensive solidity.", mentality: "very-defensive", tempo: "slow", width: "narrow", pressing: "low", passingStyle: "direct", managerPhilosophy: "direct-play" },
  { name: "Sam Allardyce", nationality: "England", philosophy: "Route-one pragmatism — long balls, set pieces, and a well-organised defence.", mentality: "very-defensive", tempo: "slow", width: "narrow", pressing: "low", passingStyle: "direct", managerPhilosophy: "direct-play" },
  { name: "Tony Pulis", nationality: "Wales", philosophy: "Long-throw and set-piece focused football built on a rigid defensive shape.", mentality: "very-defensive", tempo: "slow", width: "narrow", pressing: "low", passingStyle: "direct", managerPhilosophy: "direct-play" },
  { name: "David Moyes", nationality: "Scotland", philosophy: "Cautious, well-organised defending with disciplined counter-attacking outlets.", mentality: "defensive", tempo: "balanced", width: "narrow", pressing: "medium", passingStyle: "direct", managerPhilosophy: "counter-attack" },
  { name: "Roy Hodgson", nationality: "England", philosophy: "Deep defensive block that prioritises not conceding above all else.", mentality: "very-defensive", tempo: "slow", width: "narrow", pressing: "low", passingStyle: "direct", managerPhilosophy: "park-the-bus" },
  { name: "Rafael Benítez", nationality: "Spain", philosophy: "Meticulous defensive organisation with sharp counter-attacking sequences.", mentality: "defensive", tempo: "balanced", width: "narrow", pressing: "medium", passingStyle: "mixed", managerPhilosophy: "counter-attack" },
  { name: "Chris Wilder", nationality: "England", philosophy: "Overlapping centre-backs feeding a direct, front-footed attack.", mentality: "defensive", tempo: "balanced", width: "wide", pressing: "medium", passingStyle: "direct", managerPhilosophy: "counter-attack" },
  { name: "Steve Bruce", nationality: "England", philosophy: "Solid, unspectacular defensive setup that leans on target-man physicality.", mentality: "defensive", tempo: "slow", width: "narrow", pressing: "low", passingStyle: "direct", managerPhilosophy: "direct-play" },
  { name: "Gary O'Neil", nationality: "England", philosophy: "Well-organised low block that looks to hit teams on the break.", mentality: "defensive", tempo: "balanced", width: "narrow", pressing: "medium", passingStyle: "direct", managerPhilosophy: "counter-attack" },
  { name: "Thomas Frank", nationality: "Denmark", philosophy: "Data-driven, disciplined defensive shape with direct set-piece threat.", mentality: "defensive", tempo: "balanced", width: "balanced", pressing: "medium", passingStyle: "direct", managerPhilosophy: "counter-attack" },
  { name: "Ange Postecoglou", nationality: "Australia", philosophy: "Fearless, front-footed attacking football regardless of the opponent.", mentality: "very-attacking", tempo: "fast", width: "wide", pressing: "high", passingStyle: "short", managerPhilosophy: "possession" },
  { name: "Enzo Maresca", nationality: "Italy", philosophy: "Patient possession building through the goalkeeper and back line.", mentality: "attacking", tempo: "balanced", width: "wide", pressing: "medium", passingStyle: "short", managerPhilosophy: "possession" },
  { name: "Fabian Hürzeler", nationality: "Germany", philosophy: "High-pressing, possession-based football from a fearless young squad.", mentality: "attacking", tempo: "fast", width: "wide", pressing: "high", passingStyle: "short", managerPhilosophy: "gegenpress" },
  { name: "David Wagner", nationality: "Germany", philosophy: "Gegenpressing-inspired energy with relentless closing down of the ball.", mentality: "attacking", tempo: "fast", width: "wide", pressing: "high", passingStyle: "mixed", managerPhilosophy: "gegenpress" },
  { name: "Slaven Bilić", nationality: "Croatia", philosophy: "Balanced, attacking-minded setup built around individual quality.", mentality: "balanced", tempo: "balanced", width: "balanced", pressing: "medium", passingStyle: "mixed" },
  { name: "Andoni Iraola", nationality: "Spain", philosophy: "Intense, high-line pressing with quick vertical transitions.", mentality: "attacking", tempo: "fast", width: "wide", pressing: "high", passingStyle: "direct", managerPhilosophy: "gegenpress" },
  { name: "Kieran McKenna", nationality: "Northern Ireland", philosophy: "Modern possession-based football with a high defensive line.", mentality: "attacking", tempo: "balanced", width: "wide", pressing: "medium", passingStyle: "short", managerPhilosophy: "possession" },
  { name: "Christian Streich", nationality: "Germany", philosophy: "Well-organised, hard-working defensive structure with clear roles.", mentality: "defensive", tempo: "balanced", width: "narrow", pressing: "medium", passingStyle: "direct", managerPhilosophy: "counter-attack" },
  { name: "Bo Svensson", nationality: "Denmark", philosophy: "High-intensity pressing with an aggressive, high defensive line.", mentality: "attacking", tempo: "fast", width: "narrow", pressing: "high", passingStyle: "direct", managerPhilosophy: "gegenpress" },
  { name: "Bruno Labbadia", nationality: "Germany", philosophy: "Cautious, defensively-minded setup built on organisation over flair.", mentality: "defensive", tempo: "balanced", width: "narrow", pressing: "medium", passingStyle: "direct", managerPhilosophy: "park-the-bus" },
  { name: "Edin Terzić", nationality: "Germany", philosophy: "Vertical, high-tempo attacking football with intense counter-pressing.", mentality: "attacking", tempo: "fast", width: "wide", pressing: "high", passingStyle: "mixed", managerPhilosophy: "gegenpress" },
  { name: "Pellegrino Matarazzo", nationality: "United States", philosophy: "High-pressing, aggressive football with a high defensive line.", mentality: "attacking", tempo: "fast", width: "wide", pressing: "high", passingStyle: "direct", managerPhilosophy: "gegenpress" },
  { name: "Marco Rose", nationality: "Germany", philosophy: "Structured gegenpressing with quick vertical transitions after winning the ball.", mentality: "attacking", tempo: "fast", width: "balanced", pressing: "high", passingStyle: "mixed", managerPhilosophy: "gegenpress" },
  { name: "Domenico Tedesco", nationality: "Germany", philosophy: "Flexible back-three systems with intense, coordinated pressing.", mentality: "attacking", tempo: "fast", width: "balanced", pressing: "high", passingStyle: "mixed", managerPhilosophy: "gegenpress" },
  { name: "Oliver Glasner", nationality: "Austria", philosophy: "Direct, high-pressing football that thrives on quick transitions.", mentality: "attacking", tempo: "fast", width: "wide", pressing: "high", passingStyle: "direct", managerPhilosophy: "gegenpress" },
  { name: "Roger Schmidt", nationality: "Germany", philosophy: "Extreme gegenpressing — win it back instantly and attack at pace.", mentality: "attacking", tempo: "fast", width: "wide", pressing: "high", passingStyle: "direct", managerPhilosophy: "gegenpress" },
  { name: "Raffaele Palladino", nationality: "Italy", philosophy: "Possession-based football with fluid positional interchange up front.", mentality: "attacking", tempo: "balanced", width: "wide", pressing: "medium", passingStyle: "mixed", managerPhilosophy: "possession" },
  { name: "Fabio Grosso", nationality: "Italy", philosophy: "Attacking, possession-oriented football built on patient build-up.", mentality: "attacking", tempo: "balanced", width: "wide", pressing: "medium", passingStyle: "mixed" },
  { name: "Patrick Vieira", nationality: "France", philosophy: "Balanced, possession-based setup that looks to control the midfield.", mentality: "balanced", tempo: "balanced", width: "wide", pressing: "medium", passingStyle: "mixed" },
  { name: "Frank de Boer", nationality: "Netherlands", philosophy: "Classic Dutch positional possession play with a high defensive line.", mentality: "balanced", tempo: "balanced", width: "wide", pressing: "medium", passingStyle: "short", managerPhilosophy: "possession" },
  { name: "Bruno Génésio", nationality: "France", philosophy: "Balanced, attack-minded setup that trusts technical midfield play.", mentality: "balanced", tempo: "balanced", width: "wide", pressing: "medium", passingStyle: "mixed" },
  { name: "Lucien Favre", nationality: "Switzerland", philosophy: "Intricate, possession-based build-up with clever positional rotations.", mentality: "attacking", tempo: "balanced", width: "wide", pressing: "medium", passingStyle: "short", managerPhilosophy: "possession" },
  { name: "Peter Bosz", nationality: "Netherlands", philosophy: "Fearless attacking football with an extremely high defensive line.", mentality: "very-attacking", tempo: "fast", width: "wide", pressing: "high", passingStyle: "short", managerPhilosophy: "possession" },
  { name: "Marcel Koller", nationality: "Austria", philosophy: "Balanced, disciplined setup with an emphasis on defensive organisation.", mentality: "balanced", tempo: "balanced", width: "balanced", pressing: "medium", passingStyle: "mixed" },
  { name: "Marco Giampaolo", nationality: "Italy", philosophy: "Possession-based football built on tight passing triangles.", mentality: "attacking", tempo: "balanced", width: "wide", pressing: "medium", passingStyle: "short", managerPhilosophy: "possession" },
  { name: "Gennaro Gattuso", nationality: "Italy", philosophy: "Aggressive, high-energy pressing with a combative midfield.", mentality: "defensive", tempo: "fast", width: "narrow", pressing: "high", passingStyle: "direct", managerPhilosophy: "counter-attack" },
  { name: "Andrea Pirlo", nationality: "Italy", philosophy: "Possession-based football built from deep, patient circulation.", mentality: "attacking", tempo: "balanced", width: "wide", pressing: "medium", passingStyle: "short", managerPhilosophy: "possession" },
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main(): Promise<void> {
  console.log(`Seeding ${MANAGERS.length} real managers...`);

  const rows: Prisma.RefManagerCreateManyInput[] = MANAGERS.map((m) => ({
    id: `manager-${slugify(m.name)}`,
    name: m.name,
    nationality: m.nationality,
    philosophy: m.philosophy,
    mentality: m.mentality,
    tempo: m.tempo,
    width: m.width,
    pressing: m.pressing,
    passingStyle: m.passingStyle,
    managerPhilosophy: m.managerPhilosophy ?? null,
  }));

  // Idempotent upsert (not createMany+skipDuplicates) since this list is hand-edited and reruns
  // should sync tactical-profile tweaks onto existing rows, not silently no-op on them.
  for (const row of rows) {
    await prisma.refManager.upsert({
      where: { id: row.id! },
      update: row,
      create: row,
    });
  }

  console.log(`Upserted ${rows.length} managers.`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
