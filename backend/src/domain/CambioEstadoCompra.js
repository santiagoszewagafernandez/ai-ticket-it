export class CambioEstadoCompra {
  constructor({ id, compraId, estado, fecha, actor, motivo }) {
    Object.assign(this, { id, compraId, estado, fecha, actor, motivo });
    Object.freeze(this);
  }
}
