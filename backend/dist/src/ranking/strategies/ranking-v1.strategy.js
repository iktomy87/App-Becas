"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RankingV1Strategy = void 0;
const common_1 = require("@nestjs/common");
let RankingV1Strategy = class RankingV1Strategy {
    calcularPuntaje(padron, totalMateriasPlan = 42) {
        const promedio = Number(padron.promedio) || 0;
        const aprobadas = padron.aprobadas || 0;
        const cursando = padron.cursando || 0;
        const aplazos = padron.aplazos || 0;
        const terminoPromedio = promedio;
        const terminoAprobadas = aprobadas * 0.1;
        const terminoAvance = totalMateriasPlan > 0 ? (cursando * 3) / totalMateriasPlan : 0;
        const terminoAplazos = 2 / (1 + aplazos);
        const bonusAntecedentes = 0;
        const puntajeTotal = terminoPromedio + terminoAprobadas + terminoAvance + terminoAplazos + bonusAntecedentes;
        return {
            terminoPromedio,
            terminoAprobadas,
            terminoAvance,
            terminoAplazos,
            bonusAntecedentes,
            puntajeTotal,
        };
    }
    verificarHabilitacion(padron, config) {
        if (padron.cursando < config.minMateriasCursando) {
            return {
                habilitado: false,
                motivo: `Cursa ${padron.cursando} materias (mínimo requerido: ${config.minMateriasCursando})`,
            };
        }
        if (padron.regularizadas < config.minRegularizadas) {
            return {
                habilitado: false,
                motivo: `Tiene ${padron.regularizadas} regularizadas (mínimo requerido: ${config.minRegularizadas})`,
            };
        }
        return { habilitado: true };
    }
};
exports.RankingV1Strategy = RankingV1Strategy;
exports.RankingV1Strategy = RankingV1Strategy = __decorate([
    (0, common_1.Injectable)()
], RankingV1Strategy);
//# sourceMappingURL=ranking-v1.strategy.js.map