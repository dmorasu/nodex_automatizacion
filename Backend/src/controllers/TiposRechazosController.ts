import { Request, Response } from "express";
import TiposRechazo from "../models/tiposRechazos";

export class TiposRechazoController {

    static getAll = async (req: Request, res: Response) => {
        const tipos = await TiposRechazo.findAll({
            order: [["nombre", "ASC"]]
        });

        res.json(tipos);
    }

}