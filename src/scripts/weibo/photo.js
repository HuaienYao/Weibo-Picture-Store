/*
 * Copyright (c) 2018 The Weibo-Picture-Store Authors. All rights reserved.
 * Use of this source code is governed by a MIT-style license that can be
 * found in the LICENSE file.
 */

import {Utils} from "../sharre/utils.js";
import {USER_INFO_CACHE} from "../sharre/constant.js";
import {requestSpecialAlbumId} from "./album.js";
import {requestSignIn} from "./author.js";

/**
 * @package
 * @param {string} pid
 * @param {string} [uid]
 * @param {boolean} [_replay=false]
 * @return {Promise<void, Error>}
 */
export async function attachPhotoToSpecialAlbum(pid, uid, _replay = false) {
    const overflow = 1000; // 相册的最大存储量
    const overflowCode = 11112; // 相册存储量溢出时的返回码
    const promise = requestSpecialAlbumId(uid);
    return promise
        .then(albumInfo => {
            return Utils.fetch("http://photo.weibo.com/upload/photo", {
                method: "POST",
                body: Utils.createSearchParams({
                    pid: pid,
                    isOrig: 1,
                    album_id: albumInfo.albumId,
                }),
            });
        })
        .then(response => response.ok ? response.json() : Promise.reject(new Error(response.statusText)))
        .then(json => {
            if (json && json["code"] === 0 && json["result"]) {
                promise
                    .then(albumInfo => uid && USER_INFO_CACHE.set(uid, albumInfo))
                    .catch(reason => uid && USER_INFO_CACHE.delete(uid));
            } else if (!_replay && json && json["code"] === overflowCode) {
                promise
                    .then(albumInfo => requestPhotosFromSpecialAlbum(albumInfo, 20, 50))
                    .then(json => detachPhotoFromSpecialAlbum(json.albumId, json.photos.map(item => item.photoId)))
                    .then(json => attachPhotoToSpecialAlbum(pid, uid, true));
            }
        });
}

/**
 * @public
 * @param {string} albumId
 * @param {string[]} photoIds
 * @param {boolean} [_replay=false]
 * @return {Promise<*, Error>}
 */
async function detachPhotoFromSpecialAlbum(albumId, photoIds, _replay = false) {
    return Utils
        .fetch("http://photo.weibo.com/albums/delete_batch", {
            method: "POST",
            body: Utils.createSearchParams({
                album_id: albumId,
                photo_id: photoIds.join(","),
            }),
        })
        .then(response => response.ok ? response.json() : Promise.reject(new Error(response.statusText)))
        .then(json => {
            if (json && json["code"] === 0 && json["result"]) {
                return Promise.resolve(json);
            } else {
                return Promise.reject(new Error("Invalid Data"));
            }
        })
        .catch(reason => {
            if (_replay) {
                return Promise.reject(reason);
            } else {
                return requestSignIn(true).then(json => {
                    if (json.login) {
                        return detachPhotoFromSpecialAlbum(albumId, photoIds, true);
                    } else {
                        return Promise.reject(reason);
                    }
                });
            }
        });
}

/**
 * @public
 * @param {Object} albumInfo
 * @param {string} [albumInfo.albumId]
 * @param {number} page
 * @param {number} count
 * @param {boolean} [_replay=false]
 * @return {Promise<{
 *   total: number,
 *   albumId: string,
 *   photos: {
 *     photoId: string,
 *     picHost: string,
 *     picName: string,
 *     updated: string
 *   }[]
 * }>, Error}
 */
async function requestPhotosFromSpecialAlbum(albumInfo, page, count, _replay = false) {
    return new Promise((resolve, reject) => {
        if (albumInfo && albumInfo.albumId) {
            resolve(albumInfo);
        } else {
            reject(new Error("Invalid Data"));
        }
    }).catch(reason => {
        return requestSpecialAlbumId();
    }).then(albumInfo => {
        return Utils.fetch("http://photo.weibo.com/photos/get_all", {
            page: page,
            count: count,
            album_id: albumInfo.albumId,
            __rnd: Date.now(),
        });
    }).then(response => {
        return response.ok ? response.json() : Promise.reject(new Error(response.statusText));
    }).then(json => {
        if (json && json["code"] === 0 && json["result"]) {
            const total = json["data"]["total"];
            const albumId = json["data"]["album_id"];
            const photos = [];
            for (const item of json["data"]["photo_list"]) {
                photos.push({
                    photoId: item["photo_id"],
                    picHost: item["pic_host"],
                    picName: item["pic_name"],
                    updated: item["updated_at"],
                });
            }
            return {total, albumId, photos};
        } else {
            return Promise.reject(new Error("Invalid Data"));
        }
    }).catch(reason => {
        if (_replay) {
            return Promise.reject(reason);
        } else {
            return requestSignIn(true).then(json => {
                if (json.login) {
                    return requestPhotosFromSpecialAlbum(albumInfo, page, count, true);
                } else {
                    return Promise.reject(reason);
                }
            });
        }
    });
}