/*
 * Copyright (c) 2018 The Weibo-Picture-Store Authors. All rights reserved.
 * Use of this source code is governed by a MIT-style license that can be
 * found in the LICENSE file.
 */

/**
 * WARNING: `createImageBitmap` which cannot decode SVG(Scalable Vector Graphics)
 */
import {MAXIMUM_EDGE} from "./constant.js";

/**
 * @param blob
 * @return {Promise<Blob, Error>}
 */
export async function remuxImage(blob) {
    return createImageBitmap(blob)
        .then(bitmap => {
            const width = bitmap.width;
            const height = bitmap.height;

            if (width > MAXIMUM_EDGE || height > MAXIMUM_EDGE) {
                return Promise.reject(new Error("Beyond the border"));
            }

            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");

            canvas.width = width;
            canvas.height = height;
            context.drawImage(bitmap, 0, 0, width, height);
            bitmap.close();

            return new Promise((resolve, reject) => canvas.toBlob(blob => resolve(blob), "image/png"));
        })
        .catch(reason => {
            return Promise.reject(reason);
        });
}
