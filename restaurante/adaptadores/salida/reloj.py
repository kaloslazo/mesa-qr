from datetime import datetime, timedelta


class RelojReal:
    def ahora(self):
        return datetime.now()


class RelojSimulado:
    # sigue corriendo, pero se puede adelantar o atrasar para la demo
    def __init__(self):
        self.desfase = timedelta(0)

    def ahora(self):
        return datetime.now() + self.desfase

    def ir_a(self, hora):
        horas, minutos = (int(x) for x in hora.split(":"))
        real = datetime.now()
        self.desfase = real.replace(hour=horas, minute=minutos, second=0, microsecond=0) - real
