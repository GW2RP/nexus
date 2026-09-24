import type { Db, MongoClient } from "mongodb";

/**
 * Un client MongoDB qui survit à une connexion initiale ratée.
 *
 * Quand la toute première connexion d'un client échoue — base injoignable le
 * temps d'un déploiement, bascule de cluster Atlas, hoquet réseau au démarrage
 * d'une instance —, le driver ferme la topologie du client mais en garde la
 * référence (`mongo_client.js`, `_connect`). Or la reconnexion automatique des
 * opérations ne se déclenche que si `client.topology` est nul
 * (`execute_operation.js`) : la topologie fermée est donc réutilisée telle
 * quelle, et **toutes** les opérations suivantes échouent sur
 * « MongoTopologyClosedError: Topology is closed », pour la vie de l'instance.
 * Une panne de quelques secondes coupe ainsi la base — et avec elle la session,
 * que toute page lit — jusqu'au prochain démarrage à froid.
 *
 * On écoute donc `topologyClosed` pour repartir d'un client neuf au prochain
 * accès. La requête qui a essuyé la panne échoue toujours — la base était bien
 * absente ; ce sont les suivantes qui la retrouvent.
 *
 * Le client et la base sont rendus comme des mandataires (`Proxy`) : le code
 * les tient une fois pour toutes — Better Auth les reçoit au démarrage —, et
 * c'est chaque accès qui résout le client du moment.
 */
export function createResilientClient(
  createClient: () => MongoClient,
  dbName: string,
): { client: MongoClient; db: Db } {
  let client: MongoClient | null = null;
  let db: Db | null = null;

  // Vrai entre la fermeture subie de la topologie et le remplacement du client.
  let topologyClosed = false;

  const current = (): { client: MongoClient; db: Db } => {
    if (client && db && !topologyClosed) return { client, db };

    const previous = client;
    topologyClosed = false;

    const created = createClient();

    // Rien dans le hub ne ferme ce client : l'événement ne signale donc que la
    // fermeture subie décrite plus haut. Le test d'identité garde le drapeau
    // honnête — un client déjà remplacé qui se ferme ne doit pas faire passer
    // son successeur pour mort.
    created.on("topologyClosed", () => {
      if (client === created) topologyClosed = true;
    });

    client = created;
    db = created.db(dbName);

    // Le client remplacé n'a plus de topologie, mais garde des ressources
    // (sessions, moniteurs) qu'il vaut mieux rendre. L'échec de cette fermeture
    // n'a rien à apprendre à personne : le client est déjà mort.
    if (previous) void Promise.resolve(previous.close()).catch(() => {});

    return { client, db };
  };

  return {
    client: liveProxy(() => current().client),
    db: liveProxy(() => current().db),
  };
}

/** Un objet dont chaque propriété se lit sur la cible du moment. Les méthodes
 *  sont liées à cette cible : `db.collection(...)` s'exécute sur la base vivante,
 *  pas sur le mandataire. */
function liveProxy<T extends object>(target: () => T): T {
  return new Proxy({} as T, {
    get(_shell, property) {
      const live = target();
      const value = Reflect.get(live, property, live);
      return typeof value === "function" ? value.bind(live) : value;
    },
  });
}
