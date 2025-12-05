"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateTrainerDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_trainer_dto_1 = require("./create-trainer.dto");
class UpdateTrainerDto extends (0, mapped_types_1.PartialType)(create_trainer_dto_1.CreateTrainerDto) {
}
exports.UpdateTrainerDto = UpdateTrainerDto;
//# sourceMappingURL=update-trainer.dto.js.map